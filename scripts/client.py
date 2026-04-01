import torch
import torch.nn as nn
import torch.optim as optim
import requests
import pickle
import io
import argparse
from torch.utils.data import DataLoader

from models import HealthcareCNN
from he_utils import setup_tenseal_context, encode_and_encrypt
from dataset import get_client_dataset

# Setup TenSEAL locally for the client to encrypt sensitive data
context = setup_tenseal_context()

def run_client(client_id, server_url, width_scale):
    print(f"--- Hospital Client Node {client_id} (Compute Scale: {width_scale}) ---")
    
    # 1. Prepare data matching the client's Kaggle hospital
    train_dataset, test_dataset, data_distribution = get_client_dataset(client_id, max_samples=100)
    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
    
    # Auth Headers
    headers = {"Authorization": "Bearer secure_hospital_token_2026"}
    
    # 2. Pull Model
    print("Pulling current Global Model from Server...")
    resp = requests.get(f"{server_url}/model/{width_scale}", headers=headers)
    if resp.status_code != 200:
        raise Exception("Failed to pull model. Unauthorized or offline.")
        
    buffer = io.BytesIO(resp.content)
    global_state = torch.load(buffer, weights_only=False)
    
    model = HealthcareCNN(in_channels=1, num_classes=3, width_scale=width_scale)
    model.load_state_dict(global_state, strict=False)
    
    # 3. Evaluate current global model (for Fairness tracking)
    model.eval()
    criterion = nn.CrossEntropyLoss()
    total_loss = 0
    with torch.no_grad():
        for inputs, targets in test_loader:
            outputs = model(inputs)
            total_loss += criterion(outputs, targets).item() * inputs.size(0)
            
    eval_loss = total_loss / len(test_dataset) if len(test_dataset) > 0 else 1.0
    print(f"Hospital {client_id} baseline loss evaluated: {eval_loss:.4f}")
    
    # 4. Train locally
    print(f"Training securely on Private Hospital {client_id} Data...")
    model.train()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    for ep in range(3): # 3 local epochs
        for inputs, targets in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            
    # 5. Prepare updates
    local_state = model.state_dict()
    plaintext_state = {}
    for k, v in local_state.items():
        if 'fc2' not in k:
            plaintext_state[k] = v
            
    # Encrypt the crucial classification layer using Homomorphic Encryption
    print("Encrypting sensitive classification matrix...")
    enc_fc2_weight = encode_and_encrypt(context, local_state['fc2.weight'])
    enc_fc2_bias = encode_and_encrypt(context, local_state['fc2.bias'])
    
    payload = {
        "plaintext": plaintext_state,
        "encrypted_fc2_weight": enc_fc2_weight,
        "encrypted_fc2_bias": enc_fc2_bias
    }
    
    # 6. Transmit
    files = {
        'payload': ('update.pkl', pickle.dumps(payload), 'application/octet-stream')
    }
    data = {
        'client_id': str(client_id),
        'loss': str(eval_loss),
        'width_scale': str(width_scale),
        'distribution': data_distribution
    }
    
    print("Pushing Encrypted Model Update to Server...")
    resp = requests.post(f"{server_url}/update", files=files, data=data, headers=headers)
    print("Update accepted!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", type=int, required=True)
    parser.add_argument("--url", type=str, default="http://localhost:8000")
    parser.add_argument("--scale", type=float, default=1.0)
    args = parser.parse_args()
    
    run_client(args.id, args.url, args.scale)
