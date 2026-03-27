"""
TrustFL Central Aggregation Server
- JWT Authentication with PostgreSQL
- Generic Federated Learning (any tabular dataset)  
- Real-time dashboard analytics
- FedAvg aggregation for 2+ clients
"""
import torch
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
import io
import pickle
import json
import time
import asyncio
import bcrypt
import jwt
import os
from datetime import datetime, timedelta

from models import GenericMLP
from db import init_db, create_user, get_user_by_email, update_last_login, save_training_session, save_federated_round, get_all_users_count, get_recent_sessions, get_user_by_id

# ── App Setup ──────────────────────────────────────────────────────────────────
app = FastAPI(title="TrustFL - Federated Learning Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET = os.getenv("JWT_SECRET", "trustfl_secret_key_2026_change_in_production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# ── Federated Learning State ──────────────────────────────────────────────────
# Stores model weights from each client, keyed by a model config hash
client_updates: List[Dict] = []
client_metrics: List[Dict] = []
global_model_weights: Optional[Dict] = None
global_model_config: Optional[Dict] = None  # {input_features, num_classes}

# Connected user tracking
connected_users: Dict[str, Dict] = {}  # user_id -> {username, status, last_seen, ...}
online_users: Dict[str, float] = {}  # user_id -> last_heartbeat_timestamp

system_status = {
    "round": 0,
    "status": "Idle",
    "logs": ["🚀 TrustFL Aggregation Server initialized. Waiting for client connections..."],
    "accuracy_history": [],
    "loss_history": [],
    "client_accuracies": [],  # Per-client accuracy each round
    "connected_clients": {},
    "total_registered_users": 0,
    "online_users_count": 0,
    "global_model_version": "v0.0.0",
    "last_updated": "Never",
    "training_sessions": [],
    "fairness_metrics": [],
}

TIMEOUT_SECONDS = 120  # Wait for partial aggregation

def add_log(msg: str):
    timestamp = datetime.now().strftime("%H:%M:%S")
    entry = f"[{timestamp}] {msg}"
    print(entry)
    system_status["logs"].insert(0, entry)
    if len(system_status["logs"]) > 100:
        system_status["logs"].pop()

# ── Database Init ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    try:
        init_db()
        add_log("✅ PostgreSQL database connected and tables verified.")
    except Exception as e:
        add_log(f"⚠️ Database connection failed: {str(e)}. Running in memory-only mode.")
    asyncio.create_task(heartbeat_monitor())

async def heartbeat_monitor():
    """Monitor online users and trigger partial aggregation on timeout."""
    while True:
        await asyncio.sleep(5)
        current_time = time.time()
        
        # Update online user count
        for uid in list(online_users.keys()):
            if current_time - online_users[uid] > 60:
                del online_users[uid]
                if uid in connected_users:
                    connected_users[uid]["status"] = "🔴 Offline"
        
        system_status["online_users_count"] = len(online_users)
        
        # Partial aggregation trigger
        if len(client_updates) > 0 and (current_time - getattr(heartbeat_monitor, 'last_update_time', current_time)) > TIMEOUT_SECONDS:
            add_log(f"⚠️ Timeout reached. Proceeding with partial aggregation ({len(client_updates)} clients).")
            execute_federated_aggregation()

heartbeat_monitor.last_update_time = time.time()

# ── Auth Helpers ──────────────────────────────────────────────────────────────
def create_jwt_token(user_id: int, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = auth_header.split(" ")[1]
    return decode_jwt_token(token)

# ── Auth Endpoints ────────────────────────────────────────────────────────────
@app.post("/auth/register")
async def register(request: Request):
    body = await request.json()
    username = body.get("username", "").strip()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    
    if not username or not email or not password:
        raise HTTPException(status_code=400, detail="All fields are required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    
    try:
        user = create_user(username, email, password_hash)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    if user is None:
        raise HTTPException(status_code=409, detail="Username or email already exists")
    
    token = create_jwt_token(user["id"], user["username"])
    add_log(f"👤 New user registered: {username}")
    
    try:
        system_status["total_registered_users"] = get_all_users_count()
    except:
        pass
    
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]}
    }

@app.post("/auth/login")
async def login(request: Request):
    body = await request.json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    try:
        user = get_user_by_email(email)
    except Exception:
        user = None
    
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    try:
        update_last_login(user["id"])
    except:
        pass
    
    token = create_jwt_token(user["id"], user["username"])
    add_log(f"🔐 User logged in: {user['username']}")
    
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]}
    }

@app.get("/auth/me")
async def get_me(request: Request):
    payload = get_current_user(request)
    try:
        user = get_user_by_id(payload["user_id"])
    except:
        user = {"id": payload["user_id"], "username": payload["username"]}
    return {"user": user}

# ── Heartbeat (keeps user as "online") ────────────────────────────────────────
@app.post("/heartbeat")
async def heartbeat(request: Request):
    payload = get_current_user(request)
    uid = str(payload["user_id"])
    username = payload["username"]
    
    client_status = "Online"
    try:
        body = await request.json()
        client_status = body.get("client_status", "Online")
    except:
        pass
    
    online_users[uid] = time.time()
    connected_users[uid] = {
        "username": username,
        "status": f"🟢 {client_status}",
        "last_seen": datetime.now().strftime("%H:%M:%S"),
    }
    system_status["connected_clients"] = connected_users
    system_status["online_users_count"] = len(online_users)
    
    return {"status": "ok"}

# ── Server Status Endpoint ────────────────────────────────────────────────────
@app.get("/status")
def get_status():
    try:
        system_status["total_registered_users"] = get_all_users_count()
    except:
        pass
    system_status["online_users_count"] = len(online_users)
    return system_status

# ── Client Model Update Submission ────────────────────────────────────────────
@app.post("/submit-update")
async def submit_model_update(request: Request):
    """
    Client sends trained model weights + metrics after local training.
    Body (JSON):
      - model_weights: base64 or serialized state_dict
      - accuracy: float
      - loss: float
      - input_features: int
      - num_classes: int
      - dataset_name: str
      - num_samples: int
    """
    global global_model_config
    
    payload = get_current_user(request)
    uid = str(payload["user_id"])
    username = payload["username"]
    
    body = await request.json()
    accuracy = body.get("accuracy", 0)
    loss = body.get("loss", 0)
    input_features = body.get("input_features", 0)
    num_classes = body.get("num_classes", 0)
    dataset_name = body.get("dataset_name", "Unknown")
    num_samples = body.get("num_samples", 0)
    weights_serialized = body.get("model_weights", None)  # List of layer weight arrays
    
    if weights_serialized is None:
        raise HTTPException(status_code=400, detail="model_weights is required")
    
    # Store or validate model config
    model_config = {"input_features": input_features, "num_classes": num_classes}
    
    if global_model_config is None:
        global_model_config = model_config
    elif global_model_config["input_features"] != input_features or global_model_config["num_classes"] != num_classes:
        raise HTTPException(
            status_code=400, 
            detail=f"Model config mismatch. Server expects {global_model_config['input_features']} features and {global_model_config['num_classes']} classes. Got {input_features} features and {num_classes} classes."
        )
    
    # Deserialize weights
    weight_tensors = {}
    for key, val in weights_serialized.items():
        weight_tensors[key] = torch.tensor(val, dtype=torch.float32)
    
    client_updates.append({
        "user_id": uid,
        "username": username,
        "weights": weight_tensors,
        "accuracy": accuracy,
        "loss": loss,
    })
    
    client_metrics.append({
        "user_id": uid,
        "username": username,
        "accuracy": accuracy,
        "loss": loss,
        "dataset_name": dataset_name,
        "num_samples": num_samples,
        "input_features": input_features,
        "num_classes": num_classes,
    })
    
    # Update connected client info
    connected_users[uid] = {
        "username": username,
        "status": f"🟢 Trained (Acc: {accuracy:.1f}%)",
        "last_seen": datetime.now().strftime("%H:%M:%S"),
    }
    system_status["connected_clients"] = connected_users
    
    # Save to DB
    try:
        save_training_session(
            user_id=int(uid),
            dataset_name=dataset_name,
            num_features=input_features,
            num_samples=num_samples,
            accuracy=accuracy,
            loss=loss,
            training_round=system_status["round"] + 1
        )
    except Exception as e:
        add_log(f"⚠️ Failed to save session to DB: {str(e)}")
    
    add_log(f"📦 Update received from {username} | Accuracy: {accuracy:.2f}% | Loss: {loss:.4f} | Dataset: {dataset_name}")
    
    heartbeat_monitor.last_update_time = time.time()
    
    # Check if we should aggregate
    num_updates = len(client_updates)
    
    if num_updates == 1:
        # Single client: use their model directly
        add_log(f"⚡ Single client update from {username}. Model stored as global model.")
        execute_federated_aggregation()
    elif num_updates >= 2:
        # Multiple clients: trigger FedAvg
        add_log(f"🔄 {num_updates} client updates received. Triggering Federated Averaging...")
        execute_federated_aggregation()
    else:
        system_status["status"] = f"Waiting for more clients... ({num_updates} received)"
    
    return {
        "message": "Update accepted",
        "current_updates": num_updates,
        "round": system_status["round"]
    }

# ── Federated Averaging Aggregation ───────────────────────────────────────────
def execute_federated_aggregation():
    """
    FedAvg: Average the model weights from all participating clients.
    - 1 client: use model directly
    - 2+ clients: average weights (Federated Learning)
    """
    global global_model_weights, client_updates, client_metrics
    
    if len(client_updates) == 0:
        return
    
    num_clients = len(client_updates)
    round_num = system_status["round"] + 1
    
    add_log(f"═══ ROUND {round_num} AGGREGATION ═══")
    add_log(f"Participants: {num_clients} client(s)")
    
    # Collect metrics
    accuracies = [m["accuracy"] for m in client_metrics]
    losses = [m["loss"] for m in client_metrics]
    avg_accuracy = sum(accuracies) / len(accuracies)
    avg_loss = sum(losses) / len(losses)
    
    # Per-client accuracy report
    client_acc_report = []
    for m in client_metrics:
        client_acc_report.append(f"{m['username']}: {m['accuracy']:.1f}%")
    
    if num_clients == 1:
        # Single client: just use their weights
        add_log("📌 Single participant mode — using client model directly.")
        global_model_weights = client_updates[0]["weights"]
    else:
        # FedAvg: Average all the weights
        add_log(f"🤝 Federated Averaging with {num_clients} participants...")
        
        # Initialize aggregated weights as zeros
        first_weights = client_updates[0]["weights"]
        aggregated = {}
        for key in first_weights.keys():
            aggregated[key] = torch.zeros_like(first_weights[key], dtype=torch.float32)
        
        # Sum all weights
        for update in client_updates:
            for key in aggregated.keys():
                aggregated[key] += update["weights"][key]
        
        # Divide by number of clients (averaging)
        for key in aggregated.keys():
            aggregated[key] /= num_clients
        
        global_model_weights = aggregated
        add_log(f"✅ FedAvg completed. Averaged {len(aggregated)} parameter tensors across {num_clients} clients.")
    
    # Update system status
    system_status["accuracy_history"].append(avg_accuracy)
    system_status["loss_history"].append(avg_loss)
    system_status["client_accuracies"].append(client_acc_report)
    system_status["fairness_metrics"].append(client_acc_report)
    system_status["round"] = round_num
    system_status["global_model_version"] = f"v{round_num}.0.0"
    system_status["last_updated"] = datetime.now().strftime("%H:%M:%S")
    system_status["status"] = "Idle — Ready for next round"
    
    add_log(f"📊 Round {round_num} Avg Accuracy: {avg_accuracy:.2f}% | Avg Loss: {avg_loss:.4f}")
    
    # Save to DB
    try:
        save_federated_round(round_num, num_clients, avg_accuracy, avg_loss)
    except Exception as e:
        add_log(f"⚠️ Failed to save round to DB: {str(e)}")
    
    # Clear for next round
    client_updates.clear()
    client_metrics.clear()

# ── Get Global Model (for prediction) ─────────────────────────────────────────
@app.get("/global-model")
async def get_global_model(request: Request):
    """Returns the current global model weights and config for client prediction."""
    get_current_user(request)  # Verify auth
    
    if global_model_weights is None or global_model_config is None:
        raise HTTPException(status_code=404, detail="No global model available yet. Train at least one round first.")
    
    # Serialize weights to lists for JSON transport
    serialized = {}
    for key, tensor in global_model_weights.items():
        serialized[key] = tensor.tolist()
    
    return {
        "model_weights": serialized,
        "model_config": global_model_config,
        "round": system_status["round"],
        "accuracy": system_status["accuracy_history"][-1] if system_status["accuracy_history"] else 0,
    }

# ── Recent Sessions for Dashboard ─────────────────────────────────────────────
@app.get("/admin/sessions")
async def get_sessions():
    try:
        sessions = get_recent_sessions(20)
        # Ensure created_at is a string
        for s in sessions:
            if "created_at" in s and s["created_at"] and not isinstance(s["created_at"], str):
                s["created_at"] = str(s["created_at"])
        return sessions
    except Exception as e:
        print(f"Sessions fetch error: {e}")
        return []

# ── Serve Frontend ─────────────────────────────────────────────────────────────
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
