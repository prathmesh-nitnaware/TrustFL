import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, Activity, Brain, Stethoscope, 
  Upload, Database, Table as TableIcon, Network, 
  Lock, CheckCircle, AlertCircle, Play, 
  ArrowRight, LogOut, Search, UserCircle, Globe, Server, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = 'http://localhost:8000'; // Default, will be updated during login

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('trustfl_token'));
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('trustfl_server') || 'http://localhost:8000');
  
  // Auth state
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [clientStatus, setClientStatus] = useState('Disconnected');
  const [dataset, setDataset] = useState(null);
  const [targetColumn, setTargetColumn] = useState('');
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trainingLog, setTrainingLog] = useState('');
  const [result, setResult] = useState(null);
  
  // Prediction state
  const [useGlobal, setUseGlobal] = useState(false);
  const [predictInputs, setPredictInputs] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [xai, setXai] = useState(null);
  const [predicting, setPredicting] = useState(false);

  const FEATURE_NAMES = ["Age", "Sex", "ChestPain", "BloodPressure", "Cholesterol", "FastingSugar", "ECG", "MaxHeartRate", "ExerciseAngina", "STDepression", "Slope", "Vessels", "Thal"];

  useEffect(() => {
    if (token) fetchUser();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchUser = async () => {
    try {
      const { data } = await axios.get(`${serverUrl}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Extract my username from data.connected_clients[my_id]
      // For now, simplify and find myself or use dummy
      const myInfo = Object.values(data.connected_clients || {}).find(c => c.status.includes('Online'));
      setUser(myInfo ? { username: myInfo.username } : { username: 'Hospital Node' });
      setClientStatus('Connected');
    } catch (err) {
      setClientStatus('Offline');
    }
  };

  const checkStatus = async () => {
    if (!token) return;
    try {
      await axios.get(`${serverUrl}/status`);
      setClientStatus('Connected');
    } catch (err) {
      setClientStatus('Disconnected');
    }
  };

  const handleLogin = async () => {
    try {
      const { data } = await axios.post(`${serverUrl}/auth/login`, { email, password });
      localStorage.setItem('trustfl_token', data.token);
      localStorage.setItem('trustfl_server', serverUrl);
      setToken(data.token);
      setAuthError('');
    } catch (err) {
      setAuthError('Login failed. Check credentials.');
    }
  };

  const handleSignup = async () => {
    try {
      await axios.post(`${serverUrl}/auth/register`, { username, email, password });
      setAuthMode('login');
      setAuthError('Account created! Please sign in.');
    } catch (err) {
      setAuthError('Signup failed.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      // Local Node Endpoint (not Aggregator)
      const { data } = await axios.post(`/upload-dataset`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDataset(data);
      if (data.columns) setTargetColumn(data.columns[data.columns.length - 1]);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const startTraining = async () => {
    setTraining(true);
    setProgress(10);
    setTrainingLog('Initializing Local AI Loop...');
    try {
      // Local Node Endpoint
      const { data } = await axios.post(`/train`, {
        target_column: targetColumn,
        epochs: 10,
        server_url: serverUrl,
        token: token
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      // Simulate progress
      let p = 10;
      const t = setInterval(() => {
        p += 15;
        if (p >= 100) {
          if (t) clearInterval(t);
          setTraining(false);
          setResult(data.metrics || data);
        }
        setProgress(p);
      }, 500);
      
    } catch (err) {
      setTraining(false);
      alert('Training failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handlePrediction = async () => {
    setPredicting(true);
    try {
      const sample = FEATURE_NAMES.map(f => parseFloat(predictInputs[f] || 0));
      // Local Node Endpoint
      const { data } = await axios.post(`/predict`, { 
        sample,
        use_global: useGlobal,
        server_url: serverUrl
      }, { headers: { Authorization: `Bearer ${token}` } });
      setPrediction(data);
      if (data.explanation) setXai(data.explanation);
    } catch (err) {
      alert('Prediction failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setPredicting(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('trustfl_token');
    setToken(null);
    setUser(null);
  };

  if (!token) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full"></div>
      </div>
      
      <div className="w-full max-w-md relative">
        <div className="text-center mb-10">
          <div className="bg-teal-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-teal-500/20">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">TrustFL Client</h1>
          <p className="text-slate-400 mt-2">Privacy-Preserving Healthcare AI</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="flex gap-4 mb-8 bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${authMode === 'login' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${authMode === 'signup' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500'}`}
            >
              Register
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-black text-slate-400 px-1 italic">Aggregator Address</label>
              <div className="relative">
                <Server size={18} className="absolute left-3 top-3 text-slate-400" />
                <input 
                  type="text" 
                  value={serverUrl} 
                  onChange={e => setServerUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl outline-none focus:border-teal-500 text-sm"
                />
              </div>
            </div>

            {authMode === 'signup' && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black text-slate-400 px-1 italic">Hospital Name</label>
                <div className="relative">
                  <UserCircle size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input 
                    type="text" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl outline-none focus:border-teal-500 text-sm"
                    placeholder="General Hospital Node"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-black text-slate-400 px-1 italic">Email</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-slate-400" />
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl outline-none focus:border-teal-500 text-sm"
                  placeholder="admin@hospital.org"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-black text-slate-400 px-1 italic">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-slate-400" />
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl outline-none focus:border-teal-500 text-sm"
                />
              </div>
            </div>

            {authError && <div className="text-xs text-red-500 text-center font-bold">{authError}</div>}

            <button 
              onClick={authMode === 'login' ? handleLogin : handleSignup}
              className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20"
            >
              {authMode === 'login' ? 'Enter Dashboard' : 'Create Identity'}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Navbar */}
      <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-teal-500 p-1.5 rounded-lg">
              <ShieldCheck size={20} />
            </div>
            <span className="font-black tracking-tight text-lg">TrustFL Hospital</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <div className={`w-2 h-2 rounded-full ${clientStatus === 'Connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              {clientStatus}
            </div>
            <div className="h-6 w-[1px] bg-slate-700"></div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-400 italic">{user?.username}</span>
              <button 
                onClick={logout}
                className="p-2 bg-slate-800 rounded-lg hover:text-red-400 transition-colors"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Clinical Decision Support</h1>
            <p className="text-slate-500 mt-1">Federated training loop and diagnostic tools.</p>
          </div>
          <div className="bg-white border border-slate-200 p-2 rounded-2xl flex gap-2">
            <div className="bg-teal-50 px-4 py-2 rounded-xl text-xs font-black text-teal-700 uppercase flex items-center gap-2">
              <Network size={14} /> Node v4.0
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Workflow */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Step 2: Dataset */}
            <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 bg-teal-50 text-teal-600 rounded-bl-3xl font-black text-[10px] uppercase">
                Step 02 / Data Ingestion
              </div>
              <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                <Database className="text-teal-600" />
                Local Patient Records
              </h3>
              <p className="text-sm text-slate-400 mb-6">Connect your isolated medical database for local processing.</p>

              {!dataset ? (
                <div 
                  onClick={() => document.getElementById('dashFileInput').click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-all cursor-pointer"
                >
                  <Upload className="mx-auto text-slate-300 mb-4" size={48} />
                  <p className="font-bold text-slate-600">Select Medical CSV/Excel</p>
                  <p className="text-xs text-slate-400 mt-1 italic">Encryption remains on your hardware</p>
                  <input type="file" id="dashFileInput" onChange={handleFileUpload} hidden />
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-100 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-3 rounded-xl">
                        <TableIcon className="text-teal-600" size={24} />
                      </div>
                      <div>
                        <p className="font-black text-sm">{dataset.filename}</p>
                        <p className="text-xs text-teal-700 font-bold uppercase tracking-wider">{dataset.total_rows} Records / {dataset.columns?.length} Features</p>
                      </div>
                    </div>
                    <button onClick={() => setDataset(null)} className="text-slate-400 hover:text-red-500">
                      <LogOut size={18} />
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="text-[10px] font-black uppercase bg-white border-b border-slate-200 p-2 px-4 italic text-slate-400">Data Schema Preview</div>
                    <div className="p-4 max-h-40 overflow-auto scrollbar-thin">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-200">
                            {dataset.columns?.slice(0, 5).map(c => <th key={c} className="pb-2 font-bold px-2">{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {[1,2,3].map(r => (
                            <tr key={r} className="border-b border-slate-100 last:border-0">
                               {dataset.columns?.slice(0, 5).map(c => <td key={c} className="py-2 px-2 text-slate-500 truncate">--</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Step 3: Training */}
            <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <div className="absolute top-0 right-0 p-3 bg-blue-50 text-blue-600 rounded-bl-3xl font-black text-[10px] uppercase">
                Step 03 / AI Learning
              </div>
              <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
                <Brain className="text-blue-600" />
                Local Federated Loop
              </h3>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 px-1 italic">Target Classification</label>
                  <select 
                    value={targetColumn}
                    onChange={e => setTargetColumn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 text-sm font-bold"
                  >
                    <option value="">Choose Outcome Label...</option>
                    {dataset?.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 px-1 italic">Compute Budget (Epochs)</label>
                  <input type="number" defaultValue={10} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 text-sm font-bold" />
                </div>
              </div>

              <button 
                onClick={startTraining}
                disabled={training || !dataset || !targetColumn}
                className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-900/10 transition-all"
              >
                {training ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : (
                  <Play size={20} fill="currentColor" />
                )}
                {training ? 'Processing Neuro-Updates...' : 'Commence Training Protocol'}
              </button>

              {training && (
                <div className="mt-8 space-y-3">
                  <div className="flex justify-between text-xs font-bold uppercase text-slate-400 px-1">
                    <span>Gradient Descent Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    ></motion.div>
                  </div>
                  <p className="text-xs text-center italic text-blue-600 font-bold">{trainingLog}</p>
                </div>
              )}

              <AnimatePresence>
                {result && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-6 bg-green-50 border border-green-100 rounded-2xl flex justify-between items-center"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-3 rounded-xl shadow-sm">
                        <CheckCircle className="text-green-600" size={24} />
                      </div>
                      <div>
                        <p className="text-xs uppercase font-black text-green-700 tracking-wider">Protocol Success</p>
                        <p className="font-extrabold text-lg">Local Model Refined</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase font-black text-slate-400 tracking-wider">Accuracy Score</p>
                      <p className="text-2xl font-black text-green-700">{(result.accuracy).toFixed(1)}%</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>

          {/* Right Column - Inference */}
          <div className="lg:col-span-5 space-y-8">
            <section className="bg-slate-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden h-fit sticky top-28">
              <div className="absolute top-0 right-0 p-3 bg-teal-500 text-white rounded-bl-3xl font-black text-[10px] uppercase">
                Diagnostic Module
              </div>
              
              <h3 className="text-2xl font-bold flex items-center gap-3 mb-6">
                <Stethoscope className="text-teal-400" />
                Patient Discovery
              </h3>

              <div className="bg-slate-800/50 p-4 rounded-2xl mb-8 border border-white/5">
                <div className="flex items-center gap-4">
                  <Globe className={useGlobal ? 'text-teal-400' : 'text-slate-600'} size={24} />
                  <div className="flex-1">
                    <p className="text-sm font-bold">Consensus Governance</p>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Global Network Wisdom</p>
                  </div>
                  <button 
                    onClick={() => setUseGlobal(!useGlobal)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${useGlobal ? 'bg-teal-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${useGlobal ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>

              <div className="space-y-4 mb-8 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
                {FEATURE_NAMES.map(f => (
                  <div key={f} className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 px-1 italic tracking-widest">{f}</label>
                    <input 
                      type="number" 
                      onChange={e => setPredictInputs({...predictInputs, [f]: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-teal-400 text-sm font-bold"
                      placeholder="Enter Clinical Reading..."
                    />
                  </div>
                ))}
              </div>

              <button 
                onClick={handlePrediction}
                disabled={predicting || (!result && !useGlobal)}
                className="w-full bg-teal-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-teal-400 transition-all shadow-xl shadow-teal-500/20 disabled:opacity-20"
              >
                {predicting ? <RefreshCw className="animate-spin" size={20} /> : <Search size={20} />}
                Compute Prognosis
              </button>

              <AnimatePresence>
                {prediction && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-8 p-8 bg-white text-slate-900 rounded-3xl"
                  >
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Diagnostic Output</span>
                    <div className="text-4xl font-black tracking-tight text-slate-900 leading-none">
                      {prediction.prediction === 1 ? 'Cardiac Alert' : 'Healthy Protocol'}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                       <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-teal-500 rounded-full"
                            style={{ width: `${prediction.confidence}%` }}
                          ></div>
                       </div>
                       <span className="text-xs font-black text-teal-600">{prediction.confidence.toFixed(1)}%</span>
                    </div>

                    {/* XAI Visualization */}
                    {xai && (
                      <div className="mt-8 pt-6 border-t border-slate-100">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-4 italic tracking-widest">Neural Feature Attribution (Saliency)</p>
                        <div className="space-y-4">
                          {xai.slice(0, 5).map((it, i) => (
                            <div key={i} className="flex items-center gap-4">
                              <span className="text-[10px] font-bold text-slate-400 w-24 truncate">{it.feature}</span>
                              <div className="flex-1 h-3 bg-slate-50 rounded-full overflow-hidden relative border border-slate-100">
                                 <div 
                                    className={`h-full opacity-60 ${it.score > 0 ? 'bg-orange-400' : 'bg-blue-400'}`}
                                    style={{ 
                                      width: `${Math.abs(it.score) * 100}%`,
                                      marginLeft: it.score > 0 ? '0' : 'auto'
                                    }}
                                 ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
