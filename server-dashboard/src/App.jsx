import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Users, Activity, Repeat, Target, Shield, Server, 
  Terminal, BarChart3, Microscope, FlaskConical, Github, RefreshCw
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_URL = 'http://localhost:8000';

function App() {
  const [status, setStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [xai, setXai] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testInputs, setTestInputs] = useState({});

  const FEATURE_NAMES = ["Age", "Sex", "ChestPain", "BloodPressure", "Cholesterol", "FastingSugar", "ECG", "MaxHeartRate", "ExerciseAngina", "STDepression", "Slope", "Vessels", "Thal"];

  useEffect(() => {
    fetchStatus();
    fetchSessions();
    fetchXAI();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/status`);
      setStatus(data);
    } catch (err) {
      console.error('Server offline');
    }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/status`); // Or sessions endpoint if exists
      if (data.training_sessions) setSessions(data.training_sessions);
    } catch (err) {}
  };

  const fetchXAI = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/xai/importance`);
      if (data.feature_importance) setXai(data.feature_importance);
    } catch (err) {}
  };

  const handleTestPrediction = async () => {
    setTestLoading(true);
    try {
      const sample = FEATURE_NAMES.map(f => parseFloat(testInputs[f] || 0));
      const { data } = await axios.post(`${API_URL}/predict`, { sample });
      setTestResult(data);
    } catch (err) {
      alert('Prediction failed');
    } finally {
      setTestLoading(false);
    }
  };

  if (!status) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-mono">
      <div className="flex flex-col items-center gap-4">
        <Server className="animate-bounce" size={48} />
        <p className="animate-pulse">Connecting to TrustFL Aggregator...</p>
      </div>
    </div>
  );

  const chartData = {
    labels: status.accuracy_history.map((_, i) => `R${i+1}`),
    datasets: [
      {
        fill: true,
        label: 'Global Accuracy',
        data: status.accuracy_history,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4,
      }
    ],
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white p-6 hidden lg:flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Shield size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">TrustFL Admin</h1>
        </div>
        
        <nav className="flex-1 space-y-2">
          <a href="#" className="flex items-center gap-3 bg-slate-800 p-3 rounded-lg text-blue-400">
            <BarChart3 size={20} /> Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 hover:bg-slate-800 p-3 rounded-lg transition-colors">
            <Users size={20} /> Hospitals
          </a>
          <a href="#" className="flex items-center gap-3 hover:bg-slate-800 p-3 rounded-lg transition-colors">
            <Microscope size={20} /> XAI Insights
          </a>
          <nav className="pt-4 mt-4 border-t border-slate-800 opacity-50">
            <div className="text-xs uppercase font-bold text-slate-500 mb-2">Internal Tools</div>
            <a href="#" className="flex items-center gap-3 hover:bg-slate-800 p-3 rounded-lg transition-colors text-sm">
              <Terminal size={18} /> System Logs
            </a>
          </nav>
        </nav>
        
        <div className="mt-auto pt-6 border-t border-slate-800 text-slate-500 text-xs">
          <div className="flex justify-between items-center">
            <span>Powered by TrustFL v1.2</span>
            <Github size={14} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 p-6 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-sm text-slate-500 font-medium">Aggregator Panel</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-lg font-bold">System Online</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold">
              Round: <span className="text-blue-600">#{status.round}</span>
            </div>
            <div className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20">
              Admin Node
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Network Users', val: status.total_registered_users || 0, icon: Users, color: 'blue' },
              { label: 'Online Nodes', val: status.online_users_count || 0, icon: Activity, color: 'green' },
              { label: 'Total Rounds', val: status.round, icon: Repeat, color: 'purple' },
              { label: 'Global Accuracy', val: `${(status.accuracy_history?.[status.accuracy_history.length-1] || 0.0).toFixed(1)}%`, icon: Target, color: 'emerald' }
            ].map((st, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{st.label}</p>
                    <h3 className="text-3xl font-extrabold mt-1">{st.val}</h3>
                  </div>
                  <div className={`p-3 rounded-xl bg-${st.color}-50 text-${st.color}-600`}>
                    <st.icon size={24} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Chart */}
            <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <BarChart3 className="text-blue-600" />
                  Aggregated Convergence
                </h3>
              </div>
              <div className="h-80">
                <Line data={chartData} options={{ maintainAspectRatio: false, responsive: true }} />
              </div>
            </div>

            {/* XAI Importance */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Microscope className="text-purple-600" />
                  XAI Feature Weights
                </h3>
                <button onClick={fetchXAI} className="text-slate-400 hover:text-blue-600 transition-colors">
                  <RefreshCw size={18} />
                </button>
              </div>
              <div className="space-y-4">
                {xai.length > 0 ? xai.slice(0, 8).map((it, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                      <span>{it.feature}</span>
                      <span>{(it.importance * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-1000" 
                        style={{ width: `${it.importance * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 text-slate-400 text-sm italic">
                    Train a round to generate weights
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Connected Nodes */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold mb-6">Connected Hospital Nodes</h3>
              <div className="space-y-3">
                {Object.entries(status.connected_clients || {}).map(([id, info], i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${info.status.includes('Online') ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="font-bold">{info.username}</span>
                    </div>
                    <span className="text-xs bg-white px-3 py-1 rounded-full border border-slate-200 font-bold text-slate-500 uppercase">
                      {info.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Predict */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 bg-blue-600 text-white rounded-bl-2xl font-bold flex items-center gap-2">
                <FlaskConical size={18} /> Global consensus
              </div>
              <h3 className="text-lg font-bold mb-2">Model Verification</h3>
              <p className="text-sm text-slate-500 mb-6">Test the aggregated global model directly.</p>
              
              <div className="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto mb-6 pr-2">
                {FEATURE_NAMES.map(f => (
                  <div key={f}>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">{f}</label>
                    <input 
                      type="number" 
                      onChange={e => setTestInputs({...testInputs, [f]: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-sm focus:border-blue-500 outline-none"
                      placeholder="0.0"
                    />
                  </div>
                ))}
              </div>

              <button 
                onClick={handleTestPrediction}
                disabled={testLoading}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10"
              >
                {testLoading ? 'Processing Aggregation...' : 'Run Consensus Test'}
              </button>

              {testResult && (
                <div className="mt-6 p-6 bg-slate-900 text-white rounded-2xl animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-400 text-xs font-bold uppercase">Result</span>
                    <span className="text-blue-400 text-xs font-bold px-2 py-1 bg-blue-400/10 rounded-full border border-blue-400/20">Round #{testResult.federated_metrics.total_rounds}</span>
                  </div>
                  <div className="text-3xl font-black mb-2 text-white">
                    {testResult.prediction === 1 ? 'Disease Detected' : 'Normal'}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Confidence Score</span>
                    <span className="font-bold text-green-400">{testResult.confidence.toFixed(1)}%</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between text-xs italic opacity-70">
                    <span>Model Consistency</span>
                    <span>{testResult.federated_metrics.global_mean_accuracy.toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Logs */}
          <div className="bg-slate-950 p-8 rounded-2xl shadow-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal className="text-green-500" />
                Aggregator Logs
              </h3>
              <span className="text-slate-500 text-xs font-mono">system.kernel.v1</span>
            </div>
            <div className="h-60 overflow-y-auto font-mono text-xs space-y-2 text-slate-300 pr-2">
              {status.logs.map((log, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                  <span className={log.includes('✅') || log.includes('🚀') ? 'text-green-400' : 'text-blue-300'}>{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
