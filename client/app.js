/* ═══════════════════════════════════════════════════════
   TrustFL Client — Application Logic
   ═══════════════════════════════════════════════════════ */

const CLIENT_API = window.location.origin;
const SERVER_API_DEFAULT = "http://localhost:8000"; // Fallback only

// ── State ────────────────────────────────────────────────────────────────────
let authToken = localStorage.getItem("trustfl_token") || null;
let currentUser = JSON.parse(localStorage.getItem("trustfl_user") || "null");
let datasetColumns = [];
let featureColumns = [];
let heartbeatInterval = null;
let pollInterval = null;

// ── DOM Ready ────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const savedUrl = localStorage.getItem("trustfl_server_url");
    if (savedUrl) {
        if (document.getElementById("loginServerUrl")) document.getElementById("loginServerUrl").value = savedUrl;
        if (document.getElementById("signupServerUrl")) document.getElementById("signupServerUrl").value = savedUrl;
        if (document.getElementById("serverUrl")) document.getElementById("serverUrl").value = savedUrl;
    }

    if (authToken && currentUser) {
        showDashboard();
    }
    setupFileUpload();
});

// ═══════════════════════════════════════════════════════
//  AUTH LOGIC
// ═══════════════════════════════════════════════════════

function showLogin() {
    document.getElementById("loginForm").classList.add("active");
    document.getElementById("signupForm").classList.remove("active");
    document.getElementById("authError").textContent = "";
}

function showSignup() {
    document.getElementById("loginForm").classList.remove("active");
    document.getElementById("signupForm").classList.add("active");
    document.getElementById("authError").textContent = "";
}

function getServerUrl() {
    const el = document.getElementById("serverUrl");
    return el ? el.value.trim() : SERVER_API_DEFAULT;
}

async function handleLogin() {
    const serverUrl = document.getElementById("loginServerUrl").value.trim() || SERVER_API_DEFAULT;
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errEl = document.getElementById("authError");
    const btn = document.getElementById("loginBtn");
    
    if (!email || !password || !serverUrl) {
        errEl.textContent = "Please fill in all fields.";
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    errEl.textContent = "";
    
    try {
        const resp = await fetch(`${serverUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        
        const data = await resp.json();
        
        if (!resp.ok) {
            errEl.textContent = data.detail || "Login failed.";
            btn.disabled = false;
            btn.innerHTML = '<span>Sign In</span><i class="fa-solid fa-arrow-right"></i>';
            return;
        }
        
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem("trustfl_token", authToken);
        localStorage.setItem("trustfl_user", JSON.stringify(currentUser));
        localStorage.setItem("trustfl_server_url", serverUrl);
        if (document.getElementById("serverUrl")) document.getElementById("serverUrl").value = serverUrl;
        
        showDashboard();
    } catch (err) {
        errEl.textContent = "Cannot connect to server. Is it running?";
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span><i class="fa-solid fa-arrow-right"></i>';
    }
}

async function handleSignup() {
    const serverUrl = document.getElementById("signupServerUrl").value.trim() || SERVER_API_DEFAULT;
    const username = document.getElementById("signupUsername").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const errEl = document.getElementById("authError");
    const btn = document.getElementById("signupBtn");
    
    if (!username || !email || !password || !serverUrl) {
        errEl.textContent = "Please fill in all fields.";
        return;
    }
    
    if (password.length < 6) {
        errEl.textContent = "Password must be at least 6 characters.";
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
    errEl.textContent = "";
    
    try {
        const resp = await fetch(`${serverUrl}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password }),
        });
        
        const data = await resp.json();
        
        if (!resp.ok) {
            if (resp.status === 409) {
                errEl.textContent = "Account already exists. Try signing in instead.";
            } else {
                errEl.textContent = data.detail || "Registration failed.";
            }
            btn.disabled = false;
            btn.innerHTML = '<span>Create Account</span><i class="fa-solid fa-user-plus"></i>';
            return;
        }
        
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem("trustfl_token", authToken);
        localStorage.setItem("trustfl_user", JSON.stringify(currentUser));
        localStorage.setItem("trustfl_server_url", serverUrl);
        if (document.getElementById("serverUrl")) document.getElementById("serverUrl").value = serverUrl;
        
        showDashboard();
    } catch (err) {
        errEl.textContent = "Cannot connect to server. Is it running?";
        btn.disabled = false;
        btn.innerHTML = '<span>Create Account</span><i class="fa-solid fa-user-plus"></i>';
    }
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem("trustfl_token");
    localStorage.removeItem("trustfl_user");
    
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (pollInterval) clearInterval(pollInterval);
    
    document.getElementById("authScreen").classList.remove("hidden");
    document.getElementById("mainDashboard").classList.add("hidden");
    showLogin();
}

function showDashboard() {
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("mainDashboard").classList.remove("hidden");
    document.getElementById("headerUsername").textContent = currentUser?.username || "User";
    
    // Start heartbeat to server
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, 10000);
    
    // Start polling client status
    pollClientStatus();
    pollInterval = setInterval(pollClientStatus, 3000);
}

async function sendHeartbeat() {
    const serverUrl = getServerUrl();
    const badge = document.getElementById("connectionBadge");
    const currentStatus = document.getElementById("statusText")?.innerText || "Online";
    
    try {
        await fetch(`${serverUrl}/heartbeat`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${authToken}`,
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ client_status: currentStatus })
        });
        badge.innerHTML = '<span class="dot"></span> Connected';
        badge.classList.add("connected");
    } catch {
        badge.innerHTML = '<span class="dot"></span> Disconnected';
        badge.classList.remove("connected");
    }
}

// ═══════════════════════════════════════════════════════
//  FILE UPLOAD
// ═══════════════════════════════════════════════════════

function setupFileUpload() {
    const zone = document.getElementById("uploadZone");
    const fileInput = document.getElementById("fileInput");
    
    if (!zone || !fileInput) return;
    
    // Drag & Drop
    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragging");
    });
    
    zone.addEventListener("dragleave", () => {
        zone.classList.remove("dragging");
    });
    
    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragging");
        if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

async function handleFileUpload(file) {
    const zone = document.getElementById("uploadZone");
    const infoPanel = document.getElementById("datasetInfo");
    
    zone.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><p>Uploading dataset...</p>';
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
        const resp = await fetch(`${CLIENT_API}/upload-dataset`, {
            method: "POST",
            body: formData,
        });
        
        const data = await resp.json();
        
        if (!resp.ok) {
            zone.innerHTML = `<i class="fa-solid fa-exclamation-triangle"></i><p style="color:var(--error)">${data.detail}</p><p class="upload-hint">Click to try again</p>`;
            return;
        }
        
        // Update upload zone
        zone.classList.add("file-loaded");
        zone.innerHTML = `<i class="fa-solid fa-check-circle"></i><p>${file.name}</p><p class="upload-hint">${data.rows} rows loaded — click to replace</p>`;
        
        // Show dataset info
        document.getElementById("fileName").textContent = file.name;
        document.getElementById("dataRows").textContent = data.rows;
        infoPanel.classList.remove("hidden");
        
        // Build preview table
        if (data.sample && data.sample.length > 0) {
            const cols = Object.keys(data.sample[0]);
            let html = "<table><thead><tr>";
            cols.forEach(c => html += `<th>${c}</th>`);
            html += "</tr></thead><tbody>";
            data.sample.forEach(row => {
                html += "<tr>";
                cols.forEach(c => html += `<td>${row[c] != null ? row[c] : '-'}</td>`);
                html += "</tr>";
            });
            html += "</tbody></table>";
            document.getElementById("dataPreview").innerHTML = html;
        }
        
        // Populate target column dropdown
        datasetColumns = data.columns;
        const targetSelect = document.getElementById("targetColumn");
        targetSelect.innerHTML = "";
        data.columns.forEach(col => {
            const opt = document.createElement("option");
            opt.value = col;
            opt.textContent = col;
            targetSelect.appendChild(opt);
        });
        
        // Select last column as default target (common convention)
        targetSelect.value = data.columns[data.columns.length - 1];
        
        // Enable training
        document.getElementById("trainBtn").disabled = false;
        
        updateStatus("dataset_loaded", `Dataset loaded: ${file.name} (${data.rows} rows)`);
        
    } catch (err) {
        zone.innerHTML = `<i class="fa-solid fa-exclamation-triangle"></i><p style="color:var(--error)">Client node offline. Start client_app.py first.</p><p class="upload-hint">Click to retry</p>`;
    }
}

// ═══════════════════════════════════════════════════════
//  TRAINING
// ═══════════════════════════════════════════════════════

async function startTraining() {
    const serverUrl = getServerUrl();
    const targetColumn = document.getElementById("targetColumn").value;
    const epochs = parseInt(document.getElementById("epochs").value) || 10;
    const btn = document.getElementById("trainBtn");
    const progressContainer = document.getElementById("trainingProgress");
    const resultPanel = document.getElementById("trainingResult");
    
    if (!targetColumn) {
        alert("Please select a target column.");
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Training...';
    progressContainer.classList.remove("hidden");
    resultPanel.classList.add("hidden");
    
    updateStatus("training", "Training model locally...");
    
    try {
        const resp = await fetch(`${CLIENT_API}/train`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                server_url: serverUrl,
                target_column: targetColumn,
                token: authToken,
                epochs: epochs,
            }),
        });
        
        const data = await resp.json();
        
        if (!resp.ok) {
            alert(data.detail || "Training failed.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-play"></i> Start Federated Training';
            progressContainer.classList.add("hidden");
            updateStatus("error", "Training failed");
            return;
        }
        
        // Show results
        document.getElementById("resultAccuracy").textContent = data.accuracy.toFixed(2) + "%";
        document.getElementById("resultLoss").textContent = data.loss.toFixed(4);
        document.getElementById("resultClasses").textContent = data.classes.join(", ");
        resultPanel.classList.remove("hidden");
        
        // Build prediction inputs
        featureColumns = datasetColumns.filter(c => c !== targetColumn);
        buildPredictionInputs(featureColumns);
        document.getElementById("predictBtn").disabled = false;
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Train Again';
        
        updateStatus("success", `Training complete! Accuracy: ${data.accuracy.toFixed(2)}%`);
        
    } catch (err) {
        alert("Client node offline. Make sure client_app.py is running.");
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Start Federated Training';
        updateStatus("error", "Client node offline");
    }
    
    progressContainer.classList.add("hidden");
}

// ═══════════════════════════════════════════════════════
//  PREDICTION
// ═══════════════════════════════════════════════════════

function buildPredictionInputs(columns) {
    const container = document.getElementById("predictInputs");
    container.innerHTML = "";
    
    columns.forEach(col => {
        const div = document.createElement("div");
        div.className = "input-group";
        div.innerHTML = `
            <label>${col}</label>
            <input type="text" id="pred_${col}" placeholder="Enter value for ${col}">
        `;
        container.appendChild(div);
    });
}

async function makePrediction() {
    const serverUrl = getServerUrl();
    const useGlobal = document.getElementById("useGlobalModel").checked;
    const btn = document.getElementById("predictBtn");
    
    // Gather input values
    const inputData = {};
    let empty = false;
    featureColumns.forEach(col => {
        const input = document.getElementById(`pred_${col}`);
        const val = input.value.trim();
        if (val === "") {
            input.style.borderColor = "var(--error)";
            empty = true;
        } else {
            input.style.borderColor = "var(--border)";
        }
        inputData[col] = isNaN(val) ? val : parseFloat(val);
    });

    if (empty) {
        alert("Please fill in all input fields for prediction.");
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Predicting...';
    
    try {
        const resp = await fetch(`${CLIENT_API}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                input_data: inputData,
                use_global: useGlobal,
                server_url: serverUrl,
                token: authToken,
            }),
        });
        
        const data = await resp.json();
        
        if (!resp.ok) {
            alert(data.detail || "Prediction failed.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Predict';
            return;
        }
        
        // Display results
        const resultDiv = document.getElementById("predictionResult");
        resultDiv.classList.remove("hidden");
        
        document.getElementById("predValue").textContent = data.prediction;
        document.getElementById("predConfidence").textContent = data.confidence.toFixed(1) + "%";
        document.getElementById("predSource").textContent = data.model_source;
        
        // Probabilities
        const probsDiv = document.getElementById("predProbabilities");
        probsDiv.innerHTML = "";
        if (data.probabilities) {
            Object.entries(data.probabilities).forEach(([cls, prob]) => {
                probsDiv.innerHTML += `<span class="prob-chip">${cls}: ${prob}%</span>`;
            });
        }
        
        // XAI Explanations
        const xaiEx = document.getElementById("xaiExplanation");
        if ((data.explanation && data.explanation.length > 0) || (data.shap_explanation && data.shap_explanation.length > 0)) {
            xaiEx.classList.remove("hidden");
            
            renderXaiList("xaiSaliency", data.explanation || []);
            renderXaiList("xaiShap", data.shap_explanation || []);
            renderXaiList("xaiLime", data.lime_explanation || []);
            
            // Show first available tab
            if (data.explanation && data.explanation.length > 0) showXaiTab('saliency');
            else if (data.shap_explanation && data.shap_explanation.length > 0) showXaiTab('shap');
        } else {
            xaiEx.classList.add("hidden");
        }
        
    } catch (err) {
        console.error(err);
        alert("Prediction failed. " + (err.message || "Is the client node running?"));
    }
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Predict';
}

// ═══════════════════════════════════════════════════════
//  STATUS POLLING
// ═══════════════════════════════════════════════════════

async function pollClientStatus() {
    try {
        const resp = await fetch(`${CLIENT_API}/status`);
        const data = await resp.json();
        
        // Update progress if training
        if (data.status === "training") {
            const progressFill = document.getElementById("progressFill");
            const progressText = document.getElementById("progressText");
            if (progressFill) progressFill.style.width = data.training_progress + "%";
            if (progressText) progressText.textContent = data.message;
        }
        
        // Update status bar
        updateStatus(data.status, data.message);
    } catch {
        // Client node offline — silent
    }
}

function updateStatus(status, message) {
    const dot = document.getElementById("statusDot");
    const text = document.getElementById("statusText");
    const msg = document.getElementById("statusMessage");
    
    if (!dot || !text || !msg) return;
    
    dot.className = "status-dot";
    
    switch (status) {
        case "training":
            dot.classList.add("training");
            text.textContent = "Training";
            break;
        case "success":
            dot.classList.add("active");
            text.textContent = "Ready";
            break;
        case "error":
            dot.classList.add("error");
            text.textContent = "Error";
            break;
        case "dataset_loaded":
            dot.classList.add("active");
            text.textContent = "Dataset Loaded";
            break;
        default:
            text.textContent = "Idle";
    }
    
    msg.textContent = message || "";
}

function showXaiTab(type) {
    document.querySelectorAll('.xai-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.xai-content').forEach(c => c.classList.add('hidden'));
    
    const activeTab = document.querySelector(`.xai-tab[onclick*="${type}"]`);
    if (activeTab) activeTab.classList.add('active');
    
    const content = document.getElementById(`xai${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (content) content.classList.remove('hidden');
}

function renderXaiList(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!list || list.length === 0) {
        container.innerHTML = '<p class="muted-text" style="font-size:0.8rem; padding:10px;">Explanation not available for this model source.</p>';
        return;
    }
    
    container.innerHTML = "";
    // Show top 6 features
    list.slice(0, 6).forEach(item => {
        // Handle SHAP values which can be negative/positive
        const absScore = Math.abs(item.score);
        const displayScore = (absScore * 100).toFixed(1);
        const color = item.score >= 0 ? "var(--accent)" : "#ef4444";
        
        container.innerHTML += `
            <div style="margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-secondary); margin-bottom:2px;">
                    <span title="${item.feature}">${item.feature.length > 25 ? item.feature.substring(0, 25) + '...' : item.feature}</span>
                    <span style="color:${color}; font-weight:600;">${item.score >= 0 ? '+' : ''}${displayScore}%</span>
                </div>
                <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden;">
                    <div style="height:100%; width:${Math.min(100, displayScore)}%; background:${color};"></div>
                </div>
            </div>
        `;
    });
}
