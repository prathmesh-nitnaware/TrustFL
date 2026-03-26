import uvicorn
from fastapi import FastAPI, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sys

# Ensure backend modules can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from client import run_client

app = FastAPI(title="Hospital Node Client")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class TrainRequest(BaseModel):
    server_url: str
    dataset_id: int
    scale: float

client_status = {"state": "Idle", "message": "Awaiting local configuration..."}

def background_train_task(req: TrainRequest):
    client_status["state"] = "Processing"
    client_status["message"] = f"Validating private local Dataset {req.dataset_id} securely..."
    
    try:
        # Calls the exact logic we wrote for encrypted federated training
        run_client(req.dataset_id, req.server_url, req.scale)
        client_status["state"] = "Success"
        client_status["message"] = "✅ Privacy-Preserving local epochs finished. Encrypted weights pushed securely."
    except Exception as e:
        client_status["state"] = "Error"
        client_status["message"] = f"❌ Error occurred: {str(e)}"

@app.post("/train")
def start_local_training(req: TrainRequest, bt: BackgroundTasks):
    if client_status["state"] == "Processing":
        return {"error": "Training already in progress locally."}
        
    bt.add_task(background_train_task, req)
    return {"message": "Started local training in background."}

@app.get("/status")
def get_client_status():
    return client_status

# Mount the beautiful Hospital Web UI
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "client_frontend"))
if not os.path.exists(frontend_path):
    os.makedirs(frontend_path)
    
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="client_frontend")

if __name__ == "__main__":
    print("Hospital Client Node starting... Go to http://localhost:8001")
    uvicorn.run(app, host="127.0.0.1", port=8001)
