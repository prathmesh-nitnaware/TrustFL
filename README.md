# TrustFL: Privacy-Preserving Federated Learning for Healthcare

**TrustFL** is a high-performance, decentralized medical AI platform designed to enable collaborative machine learning between hospitals without sharing raw patient data. By combining **Federated Averaging (FedAvg)** with **Explainable AI (XAI)**, it allows for the creation of robust global models that remain transparent and clinically verifiable.

---

## 🌟 Key Features

- **🔐 Privacy-First Architecture**: Patient data never leaves the hospital's local environment. Only encrypted model weight updates are transmitted to the aggregator.
- **🧠 Explainable AI (XAI)**: 
  - **Local Saliency Maps**: Visualize feature-level attribution for individual clinical predictions.
  - **Global Feature Importance**: Real-time insights into which medical markers (Age, Blood Pressure, etc.) the global model values most.
- **⚡ Modern React + Tailwind Dashboards**: 
  - **Server Admin**: Monitor network convergence, online hospitals, and global model health.
  - **Client Node**: Multi-step medical workflow for data ingestion, local training, and diagnostic inference.
- **🔬 Model Consensus**: Admin-level sandbox to verify the aggregated global model on synthetic or test inputs.

---

## 🏗️ Tech Stack

- **Backend**: Python 3.10+, FastAPI (Asynchronous API), PyTorch (Deep Learning).
- **Frontend**: React 18, Tailwind CSS, Lucide-React (Iconography), Framer Motion (Animations).
- **Aggregation**: FedAvg (Federated Averaging) for weight consolidation.
- **Security**: JWT-based Authentication, Bcrypt password hashing.

---

## 🚀 Getting Started

### 1. Prerequisites

Ensure you have **Python 3.10+** and **Node.js 18+** installed.

```powershell
# Clone the repository
git clone https://github.com/prathmesh-nitnaware/TrustFL.git
cd TrustFL

# Install dependencies
pip install torch fast-api uvicorn pandas scikit-learn requests bcrypt pyjwt
```

### 2. Launch the Network

You can run both components using the unified launcher:

```powershell
python scripts/run_all.py
```

Or run them individually:

#### Start the Aggregator (Server)
```powershell
cd server
uvicorn server:app --port 8000 --host 0.0.0.0
```
- **Admin Dashboard**: [http://localhost:8000](http://localhost:8000)

#### Start a Hospital Node (Client)
```powershell
cd client
uvicorn client_app:app --port 8001
```
- **Node Dashboard**: [http://localhost:8001](http://localhost:8001)

---

## 📂 Project Structure

- `server/`: Central aggregator logic and static production dashboard.
- `client/`: Hospital-side node logic and static production dashboard.
- `core/`: Shared neural network architectures (`GenericMLP`).
- `server-dashboard/`: React source code for the administrator UI.
- `client-dashboard/`: React source code for the medical provider UI.
- `xai_utils.py`: Analytical engine for generating feature importances.
- `scripts/`: Operational automation and testing utilities.

---

## 🛠️ Development (Live Reload)

If you wish to modify the UI with hot-reloading:

```powershell
cd client-dashboard
npm install
npm run dev
```

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

---
**Developed by prathmesh-nitnaware | Federated Governance & Secure AI**
