import os
import glob
import torch
import torchvision.transforms as transforms
from torch.utils.data import Dataset
from PIL import Image
import kagglehub

# We unified all chest X-rays to 3 classes
CLASS_MAPPING = {
    'normal': 0,
    'pneumonia': 1,
    'covid': 2
}

KAGGLE_DATASETS = [
    "paultimothymooney/chest-xray-pneumonia",
    "tawsifurrahman/covid19-radiography-database",
    "nih-chest-xrays/data",
    "prashant268/chest-xray-covid19-pneumonia",
    "unaissait/curated-chest-xray-image-dataset-for-covid19"
]

class UniversalXRayDataset(Dataset):
    """
    Dynamically scans any Kaggle directory, identifies X-ray images,
    and infers the label dynamically based on directory naming or file names.
    Limits to a max number of samples per class for demo speed.
    """
    def __init__(self, root_dir, max_samples_per_class=100, transform=None):
        self.root_dir = root_dir
        self.transform = transform
        self.max_samples_per_class = max_samples_per_class
        
        self.samples = []
        self._build_index()

    def _infer_label(self, path):
        path_lower = path.lower()
        if 'covid' in path_lower:
            return CLASS_MAPPING['covid']
        elif 'pneumonia' in path_lower or 'opacity' in path_lower:
            return CLASS_MAPPING['pneumonia']
        elif 'normal' in path_lower or 'healthy' in path_lower or 'no finding' in path_lower:
            return CLASS_MAPPING['normal']
        return None

    def _build_index(self):
        self.counts = {0: 0, 1: 0, 2: 0}
        
        # Walk through all directories and grab images
        for root, _, files in os.walk(self.root_dir):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                    file_path = os.path.join(root, file)
                    lbl = self._infer_label(file_path)
                    
                    if lbl is not None and self.counts[lbl] < self.max_samples_per_class:
                        self.samples.append((file_path, lbl))
                        self.counts[lbl] += 1
                        
                if sum(self.counts.values()) >= len(self.counts) * self.max_samples_per_class:
                    break
            else:
                continue
            break

    @property
    def get_distribution(self):
        total = sum(self.counts.values())
        if total == 0: return "Unknown"
        return f"Normal: {self.counts[0]/total*100:.0f}%, Pneumonia: {self.counts[1]/total*100:.0f}%, COVID: {self.counts[2]/total*100:.0f}%"

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, lbl = self.samples[idx]
        image = Image.open(img_path).convert('L') # Convert X-ray to Grayscale
        if self.transform:
            image = self.transform(image)
        return image, lbl

def get_client_dataset(client_id, max_samples=100):
    if client_id < 0 or client_id >= len(KAGGLE_DATASETS):
        raise ValueError("Invalid client_id. Must be 0-4.")
        
    dataset_handle = KAGGLE_DATASETS[client_id]
    print(f"[Client {client_id}] Downloading/Validating Kaggle dataset: {dataset_handle}...")
    path = kagglehub.dataset_download(dataset_handle)
    
    transform = transforms.Compose([
        transforms.Resize((128, 128)),
        transforms.ToTensor(),
        transforms.Normalize((0.5,), (0.5,))
    ])
    
    full_dataset = UniversalXRayDataset(path, max_samples_per_class=max_samples, transform=transform)
    dist = full_dataset.get_distribution
    
    train_len = int(len(full_dataset) * 0.8)
    test_len = len(full_dataset) - train_len
    
    generator = torch.Generator().manual_seed(42)
    train_dataset, test_dataset = torch.utils.data.random_split(full_dataset, [train_len, test_len], generator=generator)
    
    return train_dataset, test_dataset, dist
