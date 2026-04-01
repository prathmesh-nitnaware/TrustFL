import torch
import numpy as np

def get_feature_importance(model, feature_names=None):
    """
    Simple XAI: Feature importance based on first-layer weights.
    For an MLP, the magnitude of the weights in the first linear layer 
    indicates how much each feature contributes to the network's internal representation.
    """
    try:
        # Get the first weight matrix (input -> first hidden layer)
        first_layer_name = None
        for name, module in model.network.named_modules():
            if isinstance(module, torch.nn.Linear):
                first_layer_name = name
                break
        
        if first_layer_name is None:
            return {"error": "No linear layer found in the model."}
        
        weights = model.network[0].weight.data.abs().cpu().numpy() # [hidden_size, input_features]
        importance = np.mean(weights, axis=0) # Average weight magnitude per feature
        
        # Normalize to sum to 1.0 (or just scale for visualization)
        total = np.sum(importance)
        if total > 0:
            importance = importance / total
            
        result = []
        for i, val in enumerate(importance):
            name = feature_names[i] if feature_names and i < len(feature_names) else f"Feature {i}"
            result.append({"feature": name, "importance": float(val)})
            
        # Sort by importance
        result.sort(key=lambda x: x["importance"], reverse=True)
        return result
    except Exception as e:
        return {"error": str(e)}

def explain_prediction(model, input_tensor, feature_names=None):
    """
    XAI: Saliency map (gradients of output with respect to input).
    Shows how much a small change in each input feature would change the output prediction.
    """
    model.eval()
    input_tensor.requires_grad_()
    
    output = model(input_tensor)
    
    # Get the class with highest probability
    target_class = output.argmax(dim=1)
    
    # Backpropagate to input
    output[0, target_class].backward()
    
    # Gradient magnitude is our explanation
    gradients = input_tensor.grad.abs().detach().cpu().numpy()[0]
    
    # Normalize
    total = np.sum(gradients)
    if total > 0:
        gradients = gradients / total
        
    result = []
    for i, val in enumerate(gradients):
        name = feature_names[i] if feature_names and i < len(feature_names) else f"Feature {i}"
        result.append({"feature": name, "score": float(val)})
        
    result.sort(key=lambda x: x["score"], reverse=True)
    return result
