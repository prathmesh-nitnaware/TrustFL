"""
TrustFL Client Node Application
- Runs on each client/hospital machine
- Handles CSV/Excel dataset upload
- Trains a GenericMLP locally
- Sends model weights + accuracy to the central server
- Can pull the global model for prediction
"""
import uvicorn
import os
import sys
import io
import json
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, TensorDataset
import shap
import lime
import lime.lime_tabular
import warnings
warnings.filterwarnings("ignore")

app = FastAPI(title="TrustFL Client Node")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from core.models import GenericMLP

def get_local_xai(model, input_tensor, feature_names):
    """Simple Saliency-based XAI for local model."""
    model.eval()
    input_tensor.requires_grad_()
    output = model(input_tensor)
    target_class = output.argmax(dim=1)
    output[0, target_class].backward()
    grads = input_tensor.grad.abs().detach().cpu().numpy()[0]
    
    total = np.sum(grads)
    if total > 0: grads /= total
    
    explanation = []
    for i, g in enumerate(grads):
        name = feature_names[i] if feature_names and i < len(feature_names) else f"F{i}"
        explanation.append({"feature": name, "score": float(g)})
    explanation.sort(key=lambda x: x["score"], reverse=True)
    return explanation

def get_shap_explanation(model, input_tensor, background_data, feature_names):
    """Generate SHAP explanations for the model prediction."""
    try:
        # Use DeepExplainer for PyTorch
        explainer = shap.DeepExplainer(model, torch.tensor(background_data[:50], dtype=torch.float32))
        shap_values = explainer.shap_values(input_tensor)
        
        # Determine the predicted class
        with torch.no_grad():
            output = model(input_tensor)
            pred_class = torch.argmax(output).item()
        
        # shap_values is a list of arrays if multi-class, or one array if binary (sometimes)
        # DeepExplainer returns a list of arrays for PyTorch
        if isinstance(shap_values, list):
            class_shap = shap_values[pred_class][0]
        else:
            class_shap = shap_values[0] if len(shap_values.shape) > 2 else shap_values[0]

        explanation = []
        for i, val in enumerate(class_shap):
            explanation.append({"feature": feature_names[i], "score": float(val)})
            
        explanation.sort(key=lambda x: abs(x["score"]), reverse=True)
        return explanation
    except Exception as e:
        print(f"SHAP Error: {str(e)}")
        return []

def get_lime_explanation(model, input_scaled, background_data, feature_names, class_names):
    """Generate LIME explanations for the model prediction."""
    try:
        explainer = lime.lime_tabular.LimeTabularExplainer(
            background_data,
            feature_names=feature_names,
            class_names=[str(c) for c in class_names],
            mode='classification'
        )
        
        def predict_fn(x):
            t = torch.tensor(x, dtype=torch.float32)
            with torch.no_grad():
                logits = model(t)
                probs = torch.nn.functional.softmax(logits, dim=1)
            return probs.numpy()
        
        # input_scaled should be 1D for lime explain_instance
        exp = explainer.explain_instance(input_scaled.flatten(), predict_fn, num_features=len(feature_names))
        
        explanation = []
        for desc, weight in exp.as_list():
            explanation.append({"feature": desc, "score": float(weight)})
        return explanation
    except Exception as e:
        print(f"LIME Error: {str(e)}")
        return []

# ── Client State ──────────────────────────────────────────────────────────────
client_state = {
    "status": "idle",
    "message": "Ready. Upload a dataset to begin.",
    "dataset_info": None,
    "training_progress": 0,
    "accuracy": 0,
    "loss": 0,
    "model_ready": False,
    "global_model_available": False,
    "columns": [],
    "target_column": None,
}

# Stored model and data processing info for prediction
local_model = None
local_scaler = None
local_label_encoder = None
local_feature_columns = None
local_model_config = None
local_feature_encoders = None
uploaded_dataset = None  # Stores the raw DataFrame
training_background = None # Sample of training data for SHAP/LIME


# ── Dataset Upload ────────────────────────────────────────────────────────────
@app.post("/upload-dataset")
async def upload_dataset(file: UploadFile = File(...)):
    """Upload a CSV or Excel file as the training dataset."""
    global uploaded_dataset
    
    filename = file.filename.lower()
    content = await file.read()
    
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    if df.shape[0] < 10:
        raise HTTPException(status_code=400, detail="Dataset must have at least 10 rows.")
    if df.shape[1] < 2:
        raise HTTPException(status_code=400, detail="Dataset must have at least 2 columns.")
    
    uploaded_dataset = df
    columns = list(df.columns)
    
    client_state["status"] = "dataset_loaded"
    client_state["message"] = f"Dataset loaded: {file.filename} ({df.shape[0]} rows, {df.shape[1]} columns)"
    client_state["columns"] = columns
    client_state["dataset_info"] = {
        "filename": file.filename,
        "rows": df.shape[0],
        "columns": df.shape[1],
        "column_names": columns,
        "dtypes": {col: str(df[col].dtype) for col in columns},
        "sample": df.head(5).to_dict(orient="records"),
    }
    
    return {
        "message": "Dataset uploaded successfully",
        "columns": columns,
        "rows": df.shape[0],
        "sample": df.head(5).to_dict(orient="records"),
    }


# ── Local Training ────────────────────────────────────────────────────────────
@app.post("/train")
async def train_model(request: Request):
    """
    Train a model locally on the uploaded dataset.
    Body: { server_url, target_column, token, epochs (optional) }
    """
    global local_model, local_scaler, local_label_encoder, local_feature_columns, local_model_config, local_feature_encoders
    
    if uploaded_dataset is None:
        raise HTTPException(status_code=400, detail="No dataset uploaded yet. Upload a dataset first.")
    
    body = await request.json()
    server_url = body.get("server_url", "http://localhost:8000")
    target_column = body.get("target_column", "")
    token = body.get("token", "")
    epochs = body.get("epochs", 10)
    
    if not target_column:
        raise HTTPException(status_code=400, detail="target_column is required.")
    if target_column not in uploaded_dataset.columns:
        raise HTTPException(status_code=400, detail=f"Column '{target_column}' not found in dataset.")
    if not token:
        raise HTTPException(status_code=400, detail="Authentication token is required.")
    
    client_state["status"] = "training"
    client_state["message"] = "Preparing data for training..."
    client_state["target_column"] = target_column
    
    try:
        df = uploaded_dataset.copy()
        
        # Separate features and target
        feature_cols = [c for c in df.columns if c != target_column]
        X = df[feature_cols].copy()
        y = df[target_column].copy()
        
        # Handle categorical features
        feature_encoders = {}
        for col in X.columns:
            if X[col].dtype == 'object' or X[col].dtype.name == 'category':
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))
                feature_encoders[col] = le
        
        # Handle missing values
        X = X.fillna(X.median(numeric_only=True))
        X = X.fillna(0)
        
        # Encode target
        label_encoder = LabelEncoder()
        y_encoded = label_encoder.fit_transform(y.astype(str))
        num_classes = len(label_encoder.classes_)
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X.values.astype(np.float32))
        
        # Split
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded if num_classes > 1 else None
        )
        
        # Convert to tensors
        X_train_t = torch.tensor(X_train, dtype=torch.float32)
        y_train_t = torch.tensor(y_train, dtype=torch.long)
        X_test_t = torch.tensor(X_test, dtype=torch.float32)
        y_test_t = torch.tensor(y_test, dtype=torch.long)
        
        train_dataset = TensorDataset(X_train_t, y_train_t)
        test_dataset = TensorDataset(X_test_t, y_test_t)
        train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
        test_loader = DataLoader(test_dataset, batch_size=64)
        
        input_features = X_train.shape[1]
        
        # Create model
        model = GenericMLP(input_features=input_features, num_classes=num_classes)
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(model.parameters(), lr=0.001)
        
        client_state["message"] = f"Training model... (0/{epochs} epochs)"
        
        # Train
        model.train()
        for epoch in range(epochs):
            epoch_loss = 0
            for batch_X, batch_y in train_loader:
                optimizer.zero_grad()
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()
            
            avg_loss = epoch_loss / len(train_loader)
            progress = int(((epoch + 1) / epochs) * 100)
            client_state["training_progress"] = progress
            client_state["message"] = f"Training... Epoch {epoch+1}/{epochs} | Loss: {avg_loss:.4f}"
        
        # Evaluate
        model.eval()
        correct = 0
        total = 0
        total_loss = 0
        with torch.no_grad():
            for batch_X, batch_y in test_loader:
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                total_loss += loss.item() * batch_X.size(0)
                _, predicted = torch.max(outputs, 1)
                total += batch_y.size(0)
                correct += (predicted == batch_y).sum().item()
        
        accuracy = (correct / total) * 100 if total > 0 else 0
        final_loss = total_loss / total if total > 0 else 0
        
        client_state["accuracy"] = accuracy
        client_state["loss"] = final_loss
        
        # Store model info
        local_model = model
        local_scaler = scaler
        local_label_encoder = label_encoder
        local_feature_columns = feature_cols
        local_model_config = {"input_features": input_features, "num_classes": num_classes}
        local_feature_encoders = feature_encoders
        training_background = X_train # Store for XAI
        
        # Serialize model weights for sending to server
        model_weights = {}
        for key, val in model.state_dict().items():
            model_weights[key] = val.tolist()
        
        # Send update to central server
        client_state["message"] = f"Training complete! Accuracy: {accuracy:.2f}%. Sending to server..."
        
        try:
            resp = requests.post(
                f"{server_url}/submit-update",
                json={
                    "model_weights": model_weights,
                    "accuracy": accuracy,
                    "loss": final_loss,
                    "input_features": input_features,
                    "num_classes": num_classes,
                    "dataset_name": client_state["dataset_info"]["filename"] if client_state["dataset_info"] else "Unknown",
                    "num_samples": len(df),
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            
            if resp.status_code == 200:
                client_state["status"] = "success"
                client_state["message"] = f"✅ Training complete! Accuracy: {accuracy:.2f}% | Weights sent to server successfully."
                client_state["model_ready"] = True
            else:
                error_detail = resp.json().get("detail", "Unknown error")
                client_state["status"] = "error"
                client_state["message"] = f"⚠️ Training done (Accuracy: {accuracy:.2f}%) but server rejected update: {error_detail}"
                client_state["model_ready"] = True
        except requests.exceptions.ConnectionError:
            client_state["status"] = "success"
            client_state["message"] = f"✅ Training complete! Accuracy: {accuracy:.2f}% | ⚠️ Could not reach server. Model saved locally."
            client_state["model_ready"] = True
        except Exception as e:
            client_state["status"] = "success"
            client_state["message"] = f"✅ Training complete! Accuracy: {accuracy:.2f}% | ⚠️ Server error: {str(e)}"
            client_state["model_ready"] = True
        
        return {
            "accuracy": accuracy,
            "loss": final_loss,
            "input_features": input_features,
            "num_classes": num_classes,
            "classes": list(label_encoder.classes_),
        }
        
    except Exception as e:
        client_state["status"] = "error"
        client_state["message"] = f"❌ Training failed: {str(e)}"
        raise HTTPException(status_code=500, detail=str(e))


# ── Local Prediction ──────────────────────────────────────────────────────────
@app.post("/predict")
async def predict(request: Request):
    """
    Make predictions using the trained model.
    Can use either the local model or pull the federated global model.
    Body: { input_data: {col1: val1, col2: val2, ...}, use_global: bool, server_url: str, token: str }
    """
    global local_model, local_scaler, local_label_encoder, local_feature_columns, local_model_config, local_feature_encoders
    
    body = await request.json()
    input_data = body.get("input_data", {})
    sample = body.get("sample", None)
    use_global = body.get("use_global", False)
    server_url = body.get("server_url", "http://localhost:8000")
    
    # Get token from body or Authorization header
    token = body.get("token", "")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    # Handle 'sample' list format (common in React dashboard)
    if not input_data and isinstance(sample, list) and local_feature_columns:
        input_data = {col: sample[i] for i, col in enumerate(local_feature_columns) if i < len(sample)}
    
    if not input_data:
        raise HTTPException(status_code=400, detail="input_data or sample list is required")
    
    model_to_use = local_model
    
    # If use_global, fetch the global model from server
    if use_global:
        try:
            resp = requests.get(
                f"{server_url}/global-model",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            if resp.status_code == 200:
                global_data = resp.json()
                config = global_data["model_config"]
                
                # Rebuild model from global weights
                model_to_use = GenericMLP(
                    input_features=config["input_features"],
                    num_classes=config["num_classes"]
                )
                state_dict = {}
                for key, val in global_data["model_weights"].items():
                    state_dict[key] = torch.tensor(val, dtype=torch.float32)
                model_to_use.load_state_dict(state_dict)
            else:
                raise HTTPException(status_code=resp.status_code, detail="Failed to fetch global model")
        except requests.exceptions.ConnectionError:
            raise HTTPException(status_code=503, detail="Cannot reach the central server")
    
    if model_to_use is None:
        raise HTTPException(status_code=400, detail="No model available. Train a model first.")
    if local_scaler is None or local_label_encoder is None or local_feature_columns is None:
        raise HTTPException(status_code=400, detail="No preprocessing pipeline available. Train a model first.")
    
    # Prepare input
    try:
        input_df = pd.DataFrame([input_data])
        
        # Ensure all feature columns exist
        for col in local_feature_columns:
            if col not in input_df.columns:
                input_df[col] = 0
        
        input_df = input_df[local_feature_columns]
        
        # Handle categorical using saved encoders
        for col in input_df.columns:
            if local_feature_encoders and col in local_feature_encoders:
                le = local_feature_encoders[col]
                known_classes = set(le.classes_)
                input_df[col] = input_df[col].apply(lambda x: le.transform([str(x)])[0] if str(x) in known_classes else 0)
            elif input_df[col].dtype == 'object':
                try:
                    input_df[col] = pd.to_numeric(input_df[col])
                except:
                    input_df[col] = 0
        
        input_scaled = local_scaler.transform(input_df.values.astype(np.float32))
        input_tensor = torch.tensor(input_scaled, dtype=torch.float32)
        
        model_to_use.eval()
        with torch.no_grad():
            output = model_to_use(input_tensor)
            probs = torch.nn.functional.softmax(output[0], dim=0)
            pred_idx = torch.argmax(probs).item()
            confidence = probs[pred_idx].item() * 100
        
        prediction = local_label_encoder.inverse_transform([pred_idx])[0]
        
        # All class probabilities
        all_probs = {}
        for idx, class_name in enumerate(local_label_encoder.classes_):
            all_probs[str(class_name)] = round(probs[idx].item() * 100, 2)
        
        # Generate explanations
        saliency_exp = []
        shap_exp = []
        lime_exp = []
        
        if not use_global:
            saliency_exp = get_local_xai(model_to_use, input_tensor, local_feature_columns)
            if training_background is not None:
                shap_exp = get_shap_explanation(model_to_use, input_tensor, training_background, local_feature_columns)
                lime_exp = get_lime_explanation(model_to_use, input_scaled, training_background, local_feature_columns, local_label_encoder.classes_)
        
        return {
            "prediction": str(prediction),
            "confidence": round(confidence, 2),
            "probabilities": all_probs,
            "model_source": "global (federated)" if use_global else "local",
            "explanation": saliency_exp, # Keep original key for compatibility
            "shap_explanation": shap_exp,
            "lime_explanation": lime_exp
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


# ── Client Status ─────────────────────────────────────────────────────────────
@app.get("/status")
def get_client_status():
    return client_state


# ── Serve React Frontend ──────────────────────────────────────────────────────────
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "client-dashboard", "dist"))
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
else:
    # Fallback to local client dir if React build missing
    app.mount("/", StaticFiles(directory=os.path.dirname(os.path.abspath(__file__)), html=True), name="frontend")

if __name__ == "__main__":
    print("🏥 TrustFL Client Node starting...")
    print("   Local:   http://localhost:8001")
    print("   Network: http://<YOUR_IP>:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)

