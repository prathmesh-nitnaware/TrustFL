import torch
import numpy as np
import shap
import lime
import lime.lime_tabular
import warnings
warnings.filterwarnings("ignore")

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

def explain_prediction_shap(model, input_tensor, background_data=None, feature_names=None):
    """
    XAI: SHAP (SHapley Additive exPlanations).
    Uses DeepExplainer for PyTorch models.
    """
    try:
        # If no background data, use a small synthetic one (not ideal, but works for demo)
        if background_data is None:
            num_features = input_tensor.shape[1]
            background_data = torch.zeros((10, num_features))
        
        explainer = shap.DeepExplainer(model, background_data)
        shap_values = explainer.shap_values(input_tensor)
        
        with torch.no_grad():
            output = model(input_tensor)
            pred_class = torch.argmax(output).item()
            
        if isinstance(shap_values, list):
            class_shap = shap_values[pred_class][0]
        else:
            class_shap = shap_values[0]

        result = []
        for i, val in enumerate(class_shap):
            name = feature_names[i] if feature_names and i < len(feature_names) else f"Feature {i}"
            result.append({"feature": name, "score": float(val)})
            
        result.sort(key=lambda x: abs(x["score"]), reverse=True)
        return result
    except Exception as e:
        return [{"feature": "SHAP Error", "score": 0, "error": str(e)}]

def explain_prediction_lime(model, input_tensor, feature_names=None):
    """
    XAI: LIME (Local Interpretable Model-Agnostic Explanations).
    Generates a local linear approximation of the model around the sample.
    """
    try:
        num_features = input_tensor.shape[1]
        # Create a synthetic training set for LIME if none provided
        training_data = np.random.normal(0, 1, size=(100, num_features))
        
        explainer = lime.lime_tabular.LimeTabularExplainer(
            training_data,
            feature_names=feature_names,
            mode='classification'
        )
        
        def predict_fn(x):
            t = torch.tensor(x, dtype=torch.float32)
            with torch.no_grad():
                logits = model(t)
                probs = torch.nn.functional.softmax(logits, dim=1)
            return probs.numpy()
        
        exp = explainer.explain_instance(input_tensor[0].detach().numpy(), predict_fn)
        
        result = []
        for desc, weight in exp.as_list():
            result.append({"feature": desc, "score": float(weight)})
        return result
    except Exception as e:
        return [{"feature": "LIME Error", "score": 0, "error": str(e)}]
