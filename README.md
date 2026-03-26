# 🏥 Fairness-Aware and Privacy-Preserving Federated Learning System for Healthcare

A production-ready, distributed machine learning architecture designed to collaboratively train a disease detection model (Pneumonia, COVID-19, Normal) across multiple independent hospital nodes without *ever* exchanging raw patient data.

---

## 🎯 Core Features

### 1. 🔒 Absolute Privacy (Homomorphic Encryption)
* **TenSEAL (CKKS)** is uniquely integrated into the torch pipeline.
* While standard Federated Learning transmits raw gradient models (vulnerable to Deep Leakage from Gradients - DLG attacks), this architecture **encrypts** the extracted submodel weights before transmission.
* The Server Aggregator performs mathematical averages on *encrypted ciphertext*, keeping data completely blind to the central server.
* Bearer Token API security explicitly protects the aggregation endpoints from rogue nodes.

### 2. ⚖️ Fairness & Dynamic Scaling (HeteroFL + q-FedAvg)
* **Resource Scaling:** Hospitals define their compute availability (`1.0x` or `0.5x`). The system slices the `HealthcareCNN` architecture dynamically, meaning low-end clinical laptops and high-end research GPUs can collaborate securely on the *exact same* federated model.
* **Fairness Mapping (q-FedAvg):** The server calculates Cross-Entropy loss gaps during aggregation. Sub-models that are struggling statistically are assigned mathematically heavier weights, preventing demographic biases from skewing the final model.

### 3. 🛡️ Fault Tolerance & Partial Aggregation
* Real-world networks drop out. An asynchronous `timeout_watcher()` actively polls heartbeat metrics from connected client interfaces. 
* If a hospital node disconnects mid-training or stalls drastically, the system dynamically calculates a **Partial Aggregation** on the survived nodes after `60 seconds`, avoiding gridlock.

### 4. 📈 Non-IID Distribution Footprints
* Datasets across real hospitals are naturally Non-Independent and Identically Distributed (Non-IID).
* To simulate and mathematically prove this resilience, nodes process multi-dimensional distributions actively downloaded securely from localized Kaggle mappings, presenting statistical proof of disparate label pools safely.

---

## 🖥️ The Dual UI Architecture

The system features two completely separated bounds of UI logic to mirror real-world roles:

### 🌐 1. Server UI (Central Monitoring Dashboard)
* **Role:** AI Administrator / Root Aggregator.
* **Function:** Monitors the global training state, client active/disconnected heartbeats, live loss/accuracy charts, failed authorization traces, and fairness metrics explicitly.
* **No Local Access:** System actively enforces blindness—no image viewing, no individual patient testing.

### 🏥 2. Client UI (Hospital Node Sandbox)
* **Role:** Individual Doctor / Clinical Operator.
* **Function:** Binds to isolated datasets representing unique geographical clinical drives. Operators specify connection endpoints, hardware limits, and initiate encrypted Local-Epoch runs.
* **No Global Vision:** Exclusively processes its own distributions, blind to other network participants.

---

## 🚀 How to Run the Distributed System

### Step 1: Initialize the Central Aggregation Server (Admin)
1. Open a new terminal.
2. Navigate to the `backend/` directory.
3. Start the FastAPI Uvicorn engine:
```bash
cd backend
uvicorn server:app --port 8000
```
4. Open the Server Dashboard globally at: **[http://localhost:8000](http://localhost:8000)**

### Step 2: Initialize Hospital Clients (Nodes)
1. Open *another* terminal (or launch this on entirely different physical laptops on the same Wi-Fi).
2. Start the local Hospital Interface wrapper:
```bash
cd backend
python client_app.py
```
3. Open the Medical Dashboard locally at: **[http://localhost:8001](http://localhost:8001)**
4. Provide the correct `Central Network URL` (e.g., `http://localhost:8000` or the IPv4 address `http://192.168.x.x:8000`), pick a dataset constraint, and initialize the federated exchange.

*To achieve true mathematical verification, spin up multiple Client terminals using different dataset identifiers to prove the Non-IID multi-institutional architecture is active!*

---

## 💻 Tech Stack
- **Backend Infrastructure:** Python, PyTorch, FastAPI, Uvicorn, Asyncio
- **Privacy Enforcement:** Microsoft TenSEAL (CKKS Scheme)
- **Frontend / Dashboards:** HTML5, CSS3, JavaScript (Fetch API), Chart.js 
- **Data Mapping:** KaggleHub, Torchvision

*Designed to demonstrate enterprise-level ML security structures emphasizing network fault tolerance, bias-mitigation, and cryptographic privacy.*
