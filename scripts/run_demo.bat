@echo off

echo ========================================================
echo   Fairness-Aware and Privacy-Preserving FL System Demo
echo ========================================================

echo 1. Installing dependencies (this might take a few minutes)...
pip install -r requirements.txt

echo.
echo 2. Running the Deep Leakage from Gradients Attack Simulation...
python attack_simulation.py

echo.
echo 3. Starting the Federated Learning Process...
python main.py

echo.
echo Demo Completed Successfully.
pause
