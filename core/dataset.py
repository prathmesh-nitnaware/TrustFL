"""
TrustFL Dataset Module
Handles user-uploaded CSV/Excel datasets for generic tabular training.
Legacy Kaggle X-ray support kept for backward compatibility.
"""
import os
import io
import torch
import numpy as np
import pandas as pd
from torch.utils.data import Dataset, TensorDataset
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split


class TabularDataset(Dataset):
    """
    A generic dataset for any CSV/Excel tabular data.
    Automatically handles categorical encoding and scaling.
    """
    def __init__(self, features, labels):
        self.features = torch.tensor(features, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.long)
    
    def __len__(self):
        return len(self.labels)
    
    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx]


def prepare_tabular_data(df, target_column, test_size=0.2, random_state=42):
    """
    Prepare a pandas DataFrame for training.
    
    Args:
        df: pandas DataFrame with the data
        target_column: name of the column to predict
        test_size: fraction for test split
        random_state: random seed
    
    Returns:
        train_dataset, test_dataset, scaler, label_encoder, feature_columns, num_classes
    """
    feature_cols = [c for c in df.columns if c != target_column]
    X = df[feature_cols].copy()
    y = df[target_column].copy()
    
    # Encode categorical features
    cat_encoders = {}
    for col in X.columns:
        if X[col].dtype == 'object' or X[col].dtype.name == 'category':
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            cat_encoders[col] = le
    
    # Handle missing values
    X = X.fillna(X.median(numeric_only=True))
    X = X.fillna(0)
    
    # Encode target
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y.astype(str))
    num_classes = len(label_encoder.classes_)
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X.values.astype(np.float32))
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y_encoded, test_size=test_size, 
        random_state=random_state,
        stratify=y_encoded if num_classes > 1 else None
    )
    
    train_dataset = TabularDataset(X_train, y_train)
    test_dataset = TabularDataset(X_test, y_test)
    
    return {
        "train_dataset": train_dataset,
        "test_dataset": test_dataset,
        "scaler": scaler,
        "label_encoder": label_encoder,
        "feature_columns": feature_cols,
        "num_classes": num_classes,
        "input_features": X_train.shape[1],
        "class_names": list(label_encoder.classes_),
    }


def load_csv_dataset(file_path_or_bytes, target_column):
    """
    Load a CSV file and prepare it for training.
    
    Args:
        file_path_or_bytes: path to CSV file or bytes/BytesIO object
        target_column: name of the target column
    
    Returns:
        Prepared dataset dictionary
    """
    if isinstance(file_path_or_bytes, (bytes, io.BytesIO)):
        if isinstance(file_path_or_bytes, bytes):
            file_path_or_bytes = io.BytesIO(file_path_or_bytes)
        df = pd.read_csv(file_path_or_bytes)
    else:
        df = pd.read_csv(file_path_or_bytes)
    
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found. Available: {list(df.columns)}")
    
    return prepare_tabular_data(df, target_column)
