# 🏥 TrustFL — Privacy-Preserving Federated Learning Platform

A production-ready distributed machine learning architecture designed to collaboratively train AI models across multiple independent nodes without *ever* exchanging raw data.

---

## 📖 Project Description & Overview

**TrustFL** is an advanced, decentralised machine learning platform built to solve the biggest hurdle in healthcare and enterprise AI: **Data Privacy & Silos**.

Traditionally, to train powerfully accurate AI models, organisations must pool their datasets into a single, centralized database. In sectors like healthcare, finance, and enterprise, this is often impossible due to strict data privacy regulations (like HIPAA, GDPR), proprietary concerns, and security risks. 

**The Solution: Federated Learning**
Instead of bringing the data to the model, TrustFL brings the *model to the data*. \
With TrustFL, multiple hospitals, companies, or individuals can collaboratively train a single global AI model. Each participant (Client Node) securely uploads their own tabular dataset locally, trains a neural network strictly on their own machine, and then only sends the mathematically derived **"model weights"** (the learned intelligence) back to a Central Server. 

The Server then performs **Federated Averaging (FedAvg)**—mathematically combining the intelligence of all participants into one highly accurate, unbiased "Global Model." This global model is then sent back down to the clients, allowing them to make predictions using the collective intelligence of the entire network, while ensuring their original raw tabular data never left their private network.

### Why TrustFL?
- **Absolute Privacy:** Raw data never traverses the internet.
- **Universal Adaptability:** Capable of automatically digesting *any* structural tabular dataset (CSV/Excel) and dynamically constructing a neural network for it.
- **Fairness & Reduced Bias:** By learning from diverse, decentralised datasets, the model avoids the demographic biases common in localized training.
- **Transparent Monitoring:** A real-time Central Dashboard allows administrators to monitor the network's health, training rounds, accuracy improvements, and fairness metrics without ever seeing the underlying data.

---

## 🎯 Core Features

### 1. 🔒 Absolute Privacy & Authentication
* **Local Training Only:** Raw data (CSV/Excel) never leaves the client's machine. Only the mathematically derived model weights are sent to the central server.
* **JWT Authentication:** Secure JWT-based login and signup system explicitly protects the client portals and aggregation endpoints.
* **Database Persistence:** Stores user accounts, training sessions, and federated rounds locally via JSON (easily upgradable to PostgreSQL).

### 2. 📊 Universal Tabular Support (GenericMLP)
* **Custom Dataset Uploads:** Drag-and-drop any CSV or Excel tabular dataset directly into the client interface.
* **Dynamic Architecture:** The neural network (`GenericMLP`) automatically adapts its input layers, hidden layers, and output size based on the specific columns and target class of your dataset.
* **Auto-Preprocessing:** Automatically handles missing values, categorical label encoding, and feature scaling.

### 3. ⚖️ Federated Averaging (FedAvg)
* If **1 node** trains: The model is used directly as the global model.
* If **2+ nodes** train: The central server performs **Federated Averaging (FedAvg)**, mathematical weight aggregation across all participants to create a stronger global model.
* Clients can choose to predict using their isolated *local model* or the collaborative *global federated model*.

### 4. 🌐 Real-Time Dual UI Dashboards

**1. Server UI (Central Monitoring Dashboard)**
* **Role:** AI Administrator / Root Aggregator.
* **Function:** Monitors the global training state in real-time. Views live registered users, connected heartbeats, active sessions, and live Chart.js graphs tracking Accuracy and Loss per federated round. Tracks Fairness Analytics explicitly.

**2. Client UI (Node Sandbox)**
* **Role:** Individual Operator / Data Owner.
* **Function:** Binds to isolated datasets. A beautifully designed 4-step workflow: Server Config → Dataset Upload → Model Training → Predictions.

---

## 🚀 How to Run the Distributed System

### Step 1: Initialize the Central Aggregation Server (Admin)
This is the machine that aggregates weights. It should be accessible on your network.

1. Open a terminal and navigate to the `backend/` directory.
2. Install dependencies:
```bash
pip install torch fastapi uvicorn requests pandas scikit-learn bcrypt pyjwt python-multipart openpyxl
```
3. Start the FastAPI Uvicorn engine:
```bash
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```
4. Open the Server Dashboard at: **[http://localhost:8000](http://localhost:8000)**

### Step 2: Initialize Client Nodes
You can run this on the same machine or *on entirely different laptops on the same Wi-Fi/LAN*.

1. Copy the project to the client machine and install dependencies.
2. Open a terminal and start the Client App:
```bash
cd backend
python client_app.py
```
3. Open the Client Dashboard at: **[http://localhost:8001](http://localhost:8001)**
4. In the Client UI Step 1 (Server Configuration):
   - If running on the same PC: keep `http://localhost:8000`
   - If running on a different PC: enter the Server's IP (e.g., `http://192.168.1.100:8000`)
5. Create an account, upload a dataset, and click Train!

---

## 💻 Tech Stack
- **Backend Infrastructure:** Python, PyTorch, FastAPI, Uvicorn
- **Data Pipeline:** Pandas, Scikit-Learn
- **Security:** PyJWT, bcrypt
- **Frontend / Dashboards:** HTML5, CSS3, Vanilla JavaScript, Chart.js 

*Designed to demonstrate enterprise-level ML security structures emphasizing network collaboration, dynamic data adaptation, and cryptographic privacy.*
