import subprocess
import time
import requests
import os

def main():
    # Detect the correct path
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    server_dir = os.path.join(root_dir, "server")
    client_dir = os.path.join(root_dir, "client")

    print("🚀 Starting Healthcare FL System Re-organized Demo...")
    
    # 1. Start Server
    print("Starting Central Server (FastAPI)...")
    server_process = subprocess.Popen(
        ["uvicorn", "server:app", "--port", "8000", "--host", "0.0.0.0"],
        cwd=server_dir
    )
    
    # Wait for the server to initialize
    time.sleep(5)
    
    # 2. Start Hospital Client
    print("Starting Hospital Client Node (FastAPI)...")
    client_process = subprocess.Popen(
        ["uvicorn", "client_app:app", "--port", "8001", "--host", "0.0.0.0"],
        cwd=client_dir
    )
    
    time.sleep(3)
    
    print("\n✅ System is running!")
    print(f"   Server Dashboard: http://localhost:8000")
    print(f"   Client Dashboard: http://localhost:8001")
    print("\nPress Ctrl+C to stop the system.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping system...")
        server_process.terminate()
        client_process.terminate()
        print("Done.")

if __name__ == "__main__":
    main()
