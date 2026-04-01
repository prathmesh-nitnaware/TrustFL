# Project Reorganization & Enhancement Report

The TrustFL project has been restructured, simplified (database removed), and enhanced with **Explainable AI (XAI)** capabilities.

## 📁 Updated Project Structure

The files are now organized based on their functionality:

- **`/server`**: Central Aggregation Server (FastAPI) and Admin Monitoring Dashboard.
- **`/client`**: Hospital Client Node (FastAPI) and Data/Training Dashboard.
- **`/core`**: Shared logic between server and client (Models, Encryption, Datasets).
- **`/data`**: Local data storage for datasets (e.g., `sample_heart.csv`).
- **`/scripts`**: Automation and simulation scripts (`run_all.py`, `attack_simulation.py`).
- **`/docs`**: Project documentation and architecture details.

## 🚀 Key Improvements

### 1. 🧠 Explainable AI (XAI) Integration
- **Global Insights**: The server now calculates and visualizes feature importance for the aggregated global model.
- **Local Explanations**: Clients can now see a "Saliency Map" explanation for each prediction, showing which patient features (Age, Blood Pressure, etc.) most influenced the AI's decision.
- **Visual Dashboards**: Added new UI sections to both dashboards to display these AI insights with high-end animations.

### 2. 🗑️ Database Removal
- The project has been decoupled from PostgreSQL/JSON file storage (`db.py` removed).
- All session data, user accounts, and training history are now managed **in-memory** within the server lifecycle, simplifying deployment and reducing overhead for the demo.

### 3. 🛠️ Code Modernization
- Fixed import paths across all modules to reflect the new directory structure.
- Updated the frontend server mounting to correctly serve dashboards from their respective directories.
- Refined the CSS for a more premium, professional feel with better typography and interactive elements.

## 🖥️ How to Run

1.  **Start the Server**:
    ```bash
    cd server
    python server.py
    ```
    *Access at: http://localhost:8000*

2.  **Start the Client(s)**:
    ```bash
    cd client
    python client_app.py
    ```
    *Access at: http://localhost:8001*

3.  **Run Simulation**:
    ```bash
    python scripts/main.py
    ```
