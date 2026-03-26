import subprocess
import time
import requests

def main():
    print("Starting Healthcare FL Server (FastAPI)...")
    server_process = subprocess.Popen(["uvicorn", "server:app", "--port", "8000"])
    
    # Wait for the server to initialize
    time.sleep(5)
    
    rounds = 3
    for r in range(rounds):
        print(f"\n================ ROUND {r+1} ================")
        
        # Simulating 2 different hospital settings as requested
        # Client 0: Large Hospital (High Resource, width_scale=1.0)
        # Client 1: Small Clinic (Low Resource, width_scale=0.5)
        
        print("Starting local training for Client 0 (High-Resource)...")
        c0 = subprocess.Popen(["python", "client.py", "--id", "0", "--scale", "1.0"])
        
        print("Starting local training for Client 1 (Low-Resource)...")
        c1 = subprocess.Popen(["python", "client.py", "--id", "1", "--scale", "0.5"])
        
        # Wait for clients to finish local training and encrypted transmission
        c0.wait()
        c1.wait()
        
        print("\nTriggering Secure & Fairness-Aware Aggregation on Server...")
        resp = requests.get("http://localhost:8000/aggregate")
        print(f"Aggregation Result: {resp.json()}")
        
        time.sleep(2)
        
    print("\n✅ FL Training Complete.")
    server_process.terminate()

if __name__ == "__main__":
    main()
