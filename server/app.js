/* ═══════════════════════════════════════════════════════
   TrustFL Server Dashboard — Real-Time Analytics
   ═══════════════════════════════════════════════════════ */

const API_URL = window.location.origin;
document.addEventListener("DOMContentLoaded", () => {
    initCharts();
    fetchStatus();
    fetchSessions();
    setInterval(fetchStatus, 2000);
    setInterval(fetchSessions, 10000);
    setTimeout(fetchXAI, 1000); // Initial XAI fetch
});

// ── Charts ───────────────────────────────────────────────────────────────────
let accuracyChart, lossChart, fairnessChart;

function initCharts() {
    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#8899b4', font: { family: 'Inter', size: 12 } }
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(30, 42, 74, 0.5)' },
                ticks: { color: '#556380', font: { family: 'Inter', size: 11 } },
                title: { display: true, text: 'Round', color: '#556380', font: { family: 'Inter' } }
            },
            y: {
                grid: { color: 'rgba(30, 42, 74, 0.5)' },
                ticks: { color: '#556380', font: { family: 'Inter', size: 11 } },
                beginAtZero: true
            }
        },
        animation: {
            duration: 800,
            easing: 'easeInOutQuart'
        }
    };

    // Accuracy Chart
    accuracyChart = new Chart(document.getElementById('accuracyChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Avg Accuracy (%)',
                data: [],
                borderColor: '#00e5a0',
                backgroundColor: 'rgba(0, 229, 160, 0.1)',
                borderWidth: 2.5,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#00e5a0',
                pointBorderColor: '#00e5a0',
                pointRadius: 4,
                pointHoverRadius: 7,
            }]
        },
        options: { ...chartDefaults }
    });

    // Loss Chart
    lossChart = new Chart(document.getElementById('lossChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Avg Loss',
                data: [],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2.5,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ef4444',
                pointBorderColor: '#ef4444',
                pointRadius: 4,
                pointHoverRadius: 7,
            }]
        },
        options: { ...chartDefaults }
    });

    // Fairness Bar Chart
    fairnessChart = new Chart(document.getElementById('fairnessChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Client Accuracy (%)',
                data: [],
                backgroundColor: [
                    'rgba(0, 229, 160, 0.6)',
                    'rgba(59, 130, 246, 0.6)',
                    'rgba(139, 92, 246, 0.6)',
                    'rgba(245, 158, 11, 0.6)',
                    'rgba(6, 182, 212, 0.6)',
                    'rgba(236, 72, 153, 0.6)',
                ],
                borderColor: [
                    '#00e5a0',
                    '#3b82f6',
                    '#8b5cf6',
                    '#f59e0b',
                    '#06b6d4',
                    '#ec4899',
                ],
                borderWidth: 1.5,
                borderRadius: 6,
            }]
        },
        options: {
            ...chartDefaults,
            scales: {
                ...chartDefaults.scales,
                x: {
                    ...chartDefaults.scales.x,
                    title: { display: false }
                },
                y: {
                    ...chartDefaults.scales.y,
                    max: 100,
                    title: { display: true, text: 'Accuracy %', color: '#556380' }
                }
            },
            plugins: {
                ...chartDefaults.plugins,
                legend: { display: false }
            }
        }
    });
}

// ── Fetch Server Status ──────────────────────────────────────────────────────
async function fetchStatus() {
    try {
        const resp = await fetch(`${API_URL}/status`);
        const data = await resp.json();

        // Check if round advanced to refresh XAI
        if (data.round > (window.lastRound || 0)) {
            window.lastRound = data.round;
            fetchXAI();
        }

        // Status Badge
        const statusPill = document.getElementById('globalStatus');
        statusPill.textContent = data.status;

        // Stats
        document.getElementById('totalUsers').textContent = data.total_registered_users || 0;
        document.getElementById('onlineUsers').textContent = data.online_users_count || 0;
        document.getElementById('currentRound').textContent = data.round || 0;
        document.getElementById('modelVersion').textContent = data.global_model_version || 'v0.0.0';
        
        const latestAcc = data.accuracy_history && data.accuracy_history.length > 0
            ? data.accuracy_history[data.accuracy_history.length - 1].toFixed(1) + '%'
            : '--';
        document.getElementById('latestAccuracy').textContent = latestAcc;

        document.getElementById('lastSync').textContent = new Date().toLocaleTimeString();

        // Update Charts
        if (data.accuracy_history && data.accuracy_history.length > 0) {
            const labels = data.accuracy_history.map((_, i) => `R${i + 1}`);
            accuracyChart.data.labels = labels;
            accuracyChart.data.datasets[0].data = data.accuracy_history;
            accuracyChart.update('none');
        }

        if (data.loss_history && data.loss_history.length > 0) {
            const labels = data.loss_history.map((_, i) => `R${i + 1}`);
            lossChart.data.labels = labels;
            lossChart.data.datasets[0].data = data.loss_history;
            lossChart.update('none');
        }

        // Connected Users
        updateUsersList(data.connected_clients || {});

        // Fairness
        if (data.fairness_metrics && data.fairness_metrics.length > 0) {
            const latestFairness = data.fairness_metrics[data.fairness_metrics.length - 1];
            updateFairnessChart(latestFairness);
        }

        // Logs
        updateTerminal(data.logs || []);

    } catch (err) {
        document.getElementById('globalStatus').textContent = 'Server Offline';
    }
}

function updateUsersList(clients) {
    const container = document.getElementById('usersList');
    const entries = Object.entries(clients);

    if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-satellite-dish"></i><p>No users connected yet</p></div>';
        return;
    }

    container.innerHTML = '';
    entries.forEach(([uid, info]) => {
        const isOffline = info.status.includes('Offline') || info.status.includes('Disconnected');
        const div = document.createElement('div');
        div.className = `user-item ${isOffline ? 'offline' : ''}`;
        div.innerHTML = `
            <div>
                <div class="user-item-name">${info.username || 'User ' + uid}</div>
                <div class="user-item-time">Last seen: ${info.last_seen || '--'}</div>
            </div>
            <div class="user-item-status">${info.status}</div>
        `;
        container.appendChild(div);
    });
}

function updateFairnessChart(fairnessData) {
    // fairnessData is array of strings like "username: 85.2%"
    const labels = [];
    const values = [];

    fairnessData.forEach(entry => {
        const parts = entry.split(':');
        if (parts.length === 2) {
            labels.push(parts[0].trim());
            values.push(parseFloat(parts[1].replace('%', '').trim()));
        }
    });

    fairnessChart.data.labels = labels;
    fairnessChart.data.datasets[0].data = values;
    fairnessChart.update('none');

    // Detail text
    const detailDiv = document.getElementById('fairnessDetail');
    if (values.length > 1) {
        const maxAcc = Math.max(...values);
        const minAcc = Math.min(...values);
        const gap = maxAcc - minAcc;
        detailDiv.innerHTML = `
            <p>Max accuracy: <strong>${maxAcc.toFixed(1)}%</strong> | 
               Min accuracy: <strong>${minAcc.toFixed(1)}%</strong> | 
               Disparity gap: <strong>${gap.toFixed(1)}%</strong></p>
        `;
    } else {
        detailDiv.innerHTML = '<p>Single participant — no fairness comparison available.</p>';
    }
}

function updateTerminal(logs) {
    const terminal = document.getElementById('terminal');
    terminal.innerHTML = '';

    logs.slice(0, 30).forEach(log => {
        const p = document.createElement('p');
        p.textContent = log;
        
        if (log.includes('⚠️') || log.includes('FAULT')) {
            p.className = 'log-warn';
        } else if (log.includes('❌') || log.includes('Error') || log.includes('failed')) {
            p.className = 'log-error';
        } else if (log.includes('✅') || log.includes('📦') || log.includes('📊')) {
            p.className = 'log-info';
        }
        
        terminal.appendChild(p);
    });
}

// ── Fetch Training Sessions ──────────────────────────────────────────────────
async function fetchSessions() {
    try {
        const resp = await fetch(`${API_URL}/admin/sessions`);
        const sessions = await resp.json();

        const tbody = document.getElementById('sessionsBody');
        
        if (!sessions || sessions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="muted">No training sessions recorded yet.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        sessions.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${s.username || 'Unknown'}</strong></td>
                <td>${s.dataset_name || '--'}</td>
                <td>${s.num_features || '--'}</td>
                <td>${s.num_samples || '--'}</td>
                <td class="acc-highlight">${s.accuracy ? s.accuracy.toFixed(2) + '%' : '--'}</td>
                <td>${s.loss ? s.loss.toFixed(4) : '--'}</td>
                <td>R${s.training_round || '--'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch {
        // Silent fail
    }
}

// ── Explainable AI ──────────────────────────────────────────────────────────
async function fetchXAI() {
    const container = document.getElementById('xaiContainer');
    if (!container) return;
    
    try {
        const resp = await fetch(`${API_URL}/xai/importance`);
        const data = await resp.json();
        const importance = data.feature_importance;

        if (importance && importance.length > 0) {
            container.innerHTML = '';
            importance.slice(0, 8).forEach(item => {
                const pct = (item.importance * 100).toFixed(1);
                const group = document.createElement('div');
                group.className = 'xai-bar-group';
                group.innerHTML = `
                    <div class="xai-bar-label">
                        <span>${item.feature}</span>
                        <span>${pct}%</span>
                    </div>
                    <div class="xai-bar-bg">
                        <div class="xai-bar-fill" style="width: ${pct}%"></div>
                    </div>
                `;
                container.appendChild(group);
            });
        }
    } catch (err) {}
}

const FEATURE_NAMES = ["Age", "Sex", "ChestPain", "BloodPressure", "Cholesterol", "FastingSugar", "ECG", "MaxHeartRate", "ExerciseAngina", "STDepression", "Slope", "Vessels", "Thal"];

function buildTestInputs() {
    const container = document.getElementById('testInputs');
    if (!container) return;
    container.innerHTML = '';
    FEATURE_NAMES.forEach(f => {
        const div = document.createElement('div');
        div.style.marginBottom = '8px';
        div.innerHTML = `
            <label style="display:block; font-size:0.7rem; color:var(--text-muted);">${f}</label>
            <input type="number" class="test-input-field" data-feature="${f}" style="width:100%; background:var(--bg-card); border:1px solid var(--border); color:white; padding:5px; border-radius:4px;" value="0">
        `;
        container.appendChild(div);
    });
}

document.getElementById('serverPredictBtn')?.addEventListener('click', async () => {
    const inputs = document.querySelectorAll('.test-input-field');
    const sample = Array.from(inputs).map(i => parseFloat(i.value) || 0);
    const btn = document.getElementById('serverPredictBtn');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running...';

    try {
        const resp = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('trustfl_token')}`
            },
            body: JSON.stringify({ sample })
        });
        const data = await resp.json();
        
        if (data.prediction !== undefined) {
            document.getElementById('testResult').classList.remove('hidden');
            document.getElementById('testValue').textContent = data.prediction === 1 ? 'Disease Detected' : 'Normal';
            document.getElementById('testConf').textContent = data.confidence.toFixed(1) + '%';
            document.getElementById('testMeanAcc').textContent = data.federated_metrics.global_mean_accuracy.toFixed(2) + '%';
        }
    } catch (err) {
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Run Inference';
    }
});

// Initial build
setTimeout(buildTestInputs, 2000);
