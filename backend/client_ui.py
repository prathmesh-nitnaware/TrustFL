import tkinter as tk
from tkinter import ttk, messagebox
import threading
import sys
import os

# Ensure the backend modules can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from client import run_client

class FLClientUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Hospital Node - FL Client UI")
        self.root.geometry("450x350")
        self.root.configure(padx=20, pady=20)
        
        # Title
        tk.Label(root, text="Federated Learning Node", font=("Helvetica", 16, "bold")).pack(pady=10)
        
        # Server URL
        tk.Label(root, text="Central Server URL:").pack(anchor="w")
        self.url_var = tk.StringVar(value="http://localhost:8000")
        tk.Entry(root, textvariable=self.url_var, width=50).pack(pady=5)
        
        # Kaggle Dataset Selector
        tk.Label(root, text="Select Local Hospital Dataset (Kaggle ID 0-4):").pack(anchor="w", pady=(10, 0))
        self.dataset_var = tk.StringVar(value="0")
        ds_dropdown = ttk.Combobox(root, textvariable=self.dataset_var, state="readonly")
        ds_dropdown['values'] = ("0 - Paul Mooney Pneumonia", 
                                 "1 - COVID-19 Radiography", 
                                 "2 - NIH Chest X-Rays", 
                                 "3 - Prashant Chest COVID", 
                                 "4 - Curated COVID-19")
        ds_dropdown.pack(pady=5, fill="x")
        
        # Compute Resources
        tk.Label(root, text="Local Hardware Capacity:").pack(anchor="w", pady=(10, 0))
        self.compute_var = tk.StringVar(value="1.0 (High GPU)")
        hw_dropdown = ttk.Combobox(root, textvariable=self.compute_var, state="readonly")
        hw_dropdown['values'] = ("1.0 (High GPU)", "0.5 (Low Resource/CPU)")
        hw_dropdown.pack(pady=5, fill="x")
        
        # Status Label
        self.status_lbl = tk.Label(root, text="Status: Ready", fg="blue", pady=10)
        self.status_lbl.pack()
        
        # Start button
        self.btn = tk.Button(root, text="Upload Data & Start Training", bg="green", fg="white", 
                             font=("Arial", 11, "bold"), command=self.start_training_thread)
        self.btn.pack(fill="x", pady=10)

    def start_training_thread(self):
        url = self.url_var.get()
        ds_id = int(self.dataset_var.get()[0])
        scale = float(self.compute_var.get()[:3])
        
        self.status_lbl.config(text="Status: Training locally... (Check Terminal)", fg="orange")
        self.btn.config(state="disabled")
        
        # Run local FL logic in a background thread to prevent UI freezing
        thread = threading.Thread(target=self.run_process, args=(ds_id, url, scale))
        thread.daemon = True
        thread.start()
        
    def run_process(self, ds_id, url, scale):
        try:
            # We call the exact flowchart steps via run_client natively!
            run_client(client_id=ds_id, server_url=url, width_scale=scale)
            
            # Update UI from thread
            self.root.after(0, self.job_finished_success)
        except Exception as e:
            self.root.after(0, lambda e=e: self.job_finished_error(e))
            
    def job_finished_success(self):
        self.status_lbl.config(text="Status: Encrypted Updates Sent Successfully!", fg="green")
        self.btn.config(state="normal")
        messagebox.showinfo("Success", "Hospital data processed locally.\nHomomorphically encrypted updates sent to central server successfully.")
        
    def job_finished_error(self, err):
        self.status_lbl.config(text="Status: Error occurred.", fg="red")
        self.btn.config(state="normal")
        messagebox.showerror("Error", f"Failed to train or push updates:\n{str(err)}")

if __name__ == "__main__":
    root = tk.Tk()
    app = FLClientUI(root)
    root.mainloop()
