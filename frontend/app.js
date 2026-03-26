document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "http://localhost:8000";

    const statusBadge = document.getElementById("globalStatus");
    const currentRound = document.getElementById("currentRound");
    const connectedCount = document.getElementById("connectedCount");
    const modelVersion = document.getElementById("modelVersion");
    const lastUpdated = document.getElementById("lastUpdated");
    const failedAuth = document.getElementById("failedAuth");
    const clientList = document.getElementById("clientList");
    const fairnessProof = document.getElementById("fairnessProof");
    const terminal = document.getElementById("terminal");

    function initChart(ctxId, labelStr, colorCode) {
        const ctx = document.getElementById(ctxId).getContext('2d');
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [], 
                datasets: [{
                    label: labelStr,
                    data: [],
                    borderColor: colorCode,
                    backgroundColor: colorCode + '1a',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, color: '#8892b0' } },
                    x: { title: { display: true, text: 'Round', color: '#8892b0' } }
                },
                plugins: { legend: { labels: { color: '#e6f1ff' } } }
            }
        });
    }

    const accuracyChart = initChart('accuracyChart', 'Accuracy (%)', '#00FFC2');
    const lossChart = initChart('lossChart', 'Avg Cross-Entropy Loss', '#ff4d4d');

    async function fetchStatus() {
        try {
            const response = await fetch(`${API_URL}/status`);
            const data = await response.json();

            // Update Global Stats
            statusBadge.textContent = "Status: " + data.status;
            currentRound.textContent = data.round;
            modelVersion.textContent = data.global_model_version;
            lastUpdated.textContent = data.last_updated;
            failedAuth.textContent = data.failed_requests;

            if (data.status.includes("Idle")) {
                statusBadge.style.backgroundColor = "rgba(100, 255, 218, 0.1)";
                statusBadge.style.color = "var(--accent)";
            } else {
                statusBadge.style.backgroundColor = "rgba(40, 167, 69, 0.1)";
                statusBadge.style.color = "#28a745";
            }

            // Update Client Roster
            clientList.innerHTML = "";
            const clients = Object.entries(data.connected_clients || {});
            connectedCount.textContent = clients.length;
            
            if (clients.length === 0) {
                clientList.innerHTML = "<div style='color:gray; font-size:14px;'>No hospitals connected yet.</div>";
            }
            
            clients.forEach(([cid, info]) => {
                const div = document.createElement("div");
                div.className = `client-item ${info.status.includes("Disconnected") ? "disconnected" : ""}`;
                div.innerHTML = `
                    <div><strong>Client Node ${cid}</strong> <br/> <span style="font-size:12px; color:gray;">Last Sync: ${info.last_update}</span></div>
                    <div style="font-size: 13px; color: #a3b8cc;">${info.status}</div>
                `;
                clientList.appendChild(div);
            });

            // Update Terminal Logs
            terminal.innerHTML = "";
            let logCount = 0;
            data.logs.forEach(log => {
                if(logCount++ > 20) return; // limit render for perf
                const p = document.createElement("p");
                let text = log;
                if (text.includes("Hospital")) p.style.color = "#00FFC2";
                if (text.includes("⚠️")) p.style.color = "#ff4d4d"; 
                p.textContent = text;
                terminal.appendChild(p);
            });
            
            // Update Fairness
            if (data.fairness_metrics && data.fairness_metrics.length > 0) {
                const latestF = data.fairness_metrics[data.fairness_metrics.length - 1];
                fairnessProof.innerHTML = "<strong>Round " + data.round + " Client Accuracies:</strong><br/>" + latestF.join("<br/>");
            }
            
            // Update Charts
            if (data.accuracy_history) {
                 accuracyChart.data.labels = data.accuracy_history.map((_, i) => `R${i+1}`);
                 accuracyChart.data.datasets[0].data = data.accuracy_history;
                 accuracyChart.update();
            }
            if (data.loss_history) {
                 lossChart.data.labels = data.loss_history.map((_, i) => `R${i+1}`);
                 lossChart.data.datasets[0].data = data.loss_history;
                 lossChart.update();
            }

        } catch (error) {
            statusBadge.textContent = "Status: Offline";
            statusBadge.style.backgroundColor = "rgba(255, 0, 0, 0.1)";
            statusBadge.style.color = "red";
        }
    }

    setInterval(fetchStatus, 2000);
    fetchStatus();
});
