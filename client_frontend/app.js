const btn = document.getElementById("uploadBtn");
const currState = document.getElementById("currState");
const msgLog = document.getElementById("msgLog");
const networkBadge = document.querySelector(".network-badge");

const LOCAL_API_URL = "http://localhost:8001";

// Poll Local Node Status
async function pollStatus() {
    try {
        const response = await fetch(`${LOCAL_API_URL}/status`);
        const data = await response.json();
        
        currState.textContent = data.state;
        currState.className = "status-indicator"; // Reset class
        
        if (data.state === "Idle") {
            btn.disabled = false;
        } else if (data.state === "Processing") {
            currState.classList.add("processing");
            currState.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Extracted Gradients`;
            btn.disabled = true;
        } else if (data.state === "Success") {
            currState.classList.add("success");
            currState.innerHTML = `<i class="fa-solid fa-check"></i> Transmission Verified`;
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Submit Next Round`;
        } else if (data.state === "Error") {
            currState.classList.add("error");
            currState.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Network Failure`;
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Retry Connection`;
        }
        
        msgLog.textContent = "> " + data.message;
        
    } catch(err) {
        msgLog.textContent = "> Local node interface offline.";
    }
}

// Fetch status every 2 seconds to keep UI synced without freezing
setInterval(pollStatus, 2000);
pollStatus();

// Train Button Click Handler
btn.addEventListener("click", async () => {
    const serverUrl = document.getElementById("serverUrl").value;
    const datasetId = document.getElementById("datasetId").value;
    const hardwareScale = document.getElementById("hardwareScale").value;
    
    // Aesthetic upgrade
    networkBadge.textContent = "Connecting to " + serverUrl;
    networkBadge.style.background = "rgba(16, 185, 129, 0.1)";
    networkBadge.style.color = "#10b981";
    networkBadge.style.borderColor = "#10b981";
    
    // Disable Button Immediately
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;

    try {
        const response = await fetch(`${LOCAL_API_URL}/train`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                server_url: serverUrl,
                dataset_id: parseInt(datasetId),
                scale: parseFloat(hardwareScale)
            })
        });
        
        const json = await response.json();
        if(json.error) {
            alert(json.error);
            btn.disabled = false;
        }
    } catch(err) {
        alert("Make sure the Hospital Local Node (client_app.py) is running on port 8001!");
        btn.disabled = false;
    }
});
