import torch
import torch.nn as nn

class GenericMLP(nn.Module):
    """
    A flexible Multi-Layer Perceptron that adapts to any tabular dataset.
    Input features and output classes are configured dynamically based on the uploaded data.
    """
    def __init__(self, input_features, num_classes, hidden_sizes=None):
        super(GenericMLP, self).__init__()
        
        if hidden_sizes is None:
            # Auto-scale hidden layers based on input size
            h1 = max(32, input_features * 2)
            h2 = max(16, input_features)
            hidden_sizes = [h1, h2]
        
        layers = []
        prev_size = input_features
        
        for h in hidden_sizes:
            layers.append(nn.Linear(prev_size, h))
            layers.append(nn.BatchNorm1d(h))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(0.3))
            prev_size = h
        
        layers.append(nn.Linear(prev_size, num_classes))
        self.network = nn.Sequential(*layers)
    
    def forward(self, x):
        return self.network(x)


class HealthcareCNN(nn.Module):
    """
    Legacy CNN model for image-based datasets (kept for backward compatibility).
    """
    def __init__(self, in_channels=1, num_classes=3, width_scale=1.0):
        super(HealthcareCNN, self).__init__()
        self.width_scale = width_scale
        
        c1 = max(4, int(16 * width_scale))
        c2 = max(8, int(32 * width_scale))
        
        self.conv1 = nn.Conv2d(in_channels, c1, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(c1)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool2d(2, 2)
        
        self.conv2 = nn.Conv2d(c1, c2, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(c2)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.MaxPool2d(2, 2)
        
        fc_in_features = c2 * 32 * 32
        h1 = max(16, int(128 * width_scale))
        
        self.fc1 = nn.Linear(fc_in_features, h1)
        self.batch_relu = nn.ReLU()
        self.fc2 = nn.Linear(h1, num_classes)
        
    def forward(self, x):
        x = self.pool1(self.relu1(self.bn1(self.conv1(x))))
        x = self.pool2(self.relu2(self.bn2(self.conv2(x))))
        x = torch.flatten(x, 1)
        x = self.batch_relu(self.fc1(x))
        x = self.fc2(x)
        return x


def extract_submodel_weights(global_state_dict, width_scale):
    target_model = HealthcareCNN(in_channels=1, num_classes=3, width_scale=width_scale)
    target_state = target_model.state_dict()
    sub_state = {}
    for key in target_state.keys():
        global_tensor = global_state_dict[key]
        target_tensor = target_state[key]
        if len(target_tensor.shape) == 4:
            sub_state[key] = global_tensor[:target_tensor.shape[0], :target_tensor.shape[1], :, :]
        elif len(target_tensor.shape) == 2:
            sub_state[key] = global_tensor[:target_tensor.shape[0], :target_tensor.shape[1]]
        elif len(target_tensor.shape) == 1:
            sub_state[key] = global_tensor[:target_tensor.shape[0]]
    return sub_state

def insert_submodel_weights(global_state_dict, sub_state_dict):
    padded_update = {}
    for key, sub_tensor in sub_state_dict.items():
        global_tensor = global_state_dict[key]
        padded_update[key] = torch.zeros_like(global_tensor)
        if len(sub_tensor.shape) == 4:
            padded_update[key][:sub_tensor.shape[0], :sub_tensor.shape[1], :, :] = sub_tensor
        elif len(sub_tensor.shape) == 2:
            padded_update[key][:sub_tensor.shape[0], :sub_tensor.shape[1]] = sub_tensor
        elif len(sub_tensor.shape) == 1:
            padded_update[key][:sub_tensor.shape[0]] = sub_tensor
    return padded_update
