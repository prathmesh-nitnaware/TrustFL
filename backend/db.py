"""
TrustFL - File-based storage for user accounts and training sessions.
Uses a local JSON file instead of PostgreSQL for simplicity.
"""
import json
import os
import time
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trustfl_data.json")

def _load_db():
    """Load the JSON database file."""
    if not os.path.exists(DB_FILE):
        return {"users": [], "training_sessions": [], "federated_rounds": [], "next_user_id": 1}
    with open(DB_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"users": [], "training_sessions": [], "federated_rounds": [], "next_user_id": 1}

def _save_db(data):
    """Save the JSON database file."""
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)

def init_db():
    """Initialize database file if it doesn't exist."""
    if not os.path.exists(DB_FILE):
        _save_db({"users": [], "training_sessions": [], "federated_rounds": [], "next_user_id": 1})
    print("✅ File-based database initialized.")

def create_user(username: str, email: str, password_hash: str):
    """Create a new user account."""
    db = _load_db()
    
    # Check uniqueness
    for u in db["users"]:
        if u["email"] == email or u["username"] == username:
            return None
    
    user_id = db["next_user_id"]
    user = {
        "id": user_id,
        "username": username,
        "email": email,
        "password_hash": password_hash,
        "created_at": datetime.now().isoformat(),
        "last_login": None,
        "is_active": True
    }
    db["users"].append(user)
    db["next_user_id"] = user_id + 1
    _save_db(db)
    
    return {"id": user_id, "username": username, "email": email, "created_at": user["created_at"]}

def get_user_by_email(email: str):
    """Retrieve a user by email."""
    db = _load_db()
    for u in db["users"]:
        if u["email"] == email:
            return dict(u)
    return None

def get_user_by_id(user_id: int):
    """Retrieve a user by ID."""
    db = _load_db()
    for u in db["users"]:
        if u["id"] == user_id:
            return {"id": u["id"], "username": u["username"], "email": u["email"], "created_at": u["created_at"], "last_login": u["last_login"]}
    return None

def update_last_login(user_id: int):
    """Update the last login timestamp."""
    db = _load_db()
    for u in db["users"]:
        if u["id"] == user_id:
            u["last_login"] = datetime.now().isoformat()
            break
    _save_db(db)

def save_training_session(user_id: int, dataset_name: str, num_features: int, num_samples: int, accuracy: float, loss: float, training_round: int):
    """Save a training session record."""
    db = _load_db()
    
    # Find username
    username = "Unknown"
    for u in db["users"]:
        if u["id"] == user_id:
            username = u["username"]
            break
    
    session = {
        "id": len(db["training_sessions"]) + 1,
        "user_id": user_id,
        "username": username,
        "dataset_name": dataset_name,
        "num_features": num_features,
        "num_samples": num_samples,
        "accuracy": accuracy,
        "loss": loss,
        "training_round": training_round,
        "created_at": datetime.now().isoformat()
    }
    db["training_sessions"].append(session)
    _save_db(db)

def save_federated_round(round_number: int, num_participants: int, avg_accuracy: float, avg_loss: float):
    """Save a federated aggregation round."""
    db = _load_db()
    fedround = {
        "id": len(db["federated_rounds"]) + 1,
        "round_number": round_number,
        "num_participants": num_participants,
        "avg_accuracy": avg_accuracy,
        "avg_loss": avg_loss,
        "aggregation_method": "FedAvg",
        "created_at": datetime.now().isoformat()
    }
    db["federated_rounds"].append(fedround)
    _save_db(db)

def get_all_users_count():
    """Get total registered users count."""
    db = _load_db()
    return len(db["users"])

def get_recent_sessions(limit: int = 20):
    """Get recent training sessions."""
    db = _load_db()
    sessions = db["training_sessions"][-limit:]
    sessions.reverse()
    return sessions
