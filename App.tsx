
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { ArgonState, Transcription, LinkedDevice } from './types';
import { decode, encode, decodeAudioData } from './utils/audio-utils';

const MASTER_PASSWORD = "ihsan";
const ADMIN_NAME = "Iqbal";

interface SystemAlert {
  id: string;
  type: 'CRITICAL' | 'WARNING';
  message: string;
  category: 'THERMAL' | 'NEURAL' | 'STABILITY' | 'NETWORK';
  timestamp: number;
}

const INITIAL_DEVICES: LinkedDevice[] = [
  { id: '1', name: 'ZIM_MOBILE_ALPHA', type: 'Mobile', distance: '0.2m', status: 'linked', isPowered: true },
  { id: '2', name: 'CITY_SECURITY_NODE_4', type: 'Security', distance: '1.4m', status: 'unauthorized', isPowered: false },
  { id: '3', name: 'IOT_SMART_HUB_09', type: 'IOT', distance: '2.1m', status: 'linked', isPowered: true },
  { id: '4', name: 'SATELLITE_UPLINK_PRO', type: 'Link', distance: 'Orbital', status: 'linked', isPowered: true },
];

const App: React.FC = () => {
  const [argonState, setArgonState] = useState<ArgonState>(ArgonState.OFFLINE);
  const [transcriptions, setTranscriptions] = useState<(Transcription & { sources?: { title: string, uri: string }[] })[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'cognition' | 'network' | 'deployment'>('cognition');
  const [linkedDevices, setLinkedDevices] = useState<LinkedDevice[]>(INITIAL_DEVICES);
  const [isWorldwideLinkActive, setIsWorldwideLinkActive] = useState(true);

  // Installation Setup
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installingStatus, setInstallingStatus] = useState<'idle' | 'diagnostic' | 'ready'>('idle');

  // Auth & System State
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Telemetry Stats
  const [thinkingInput, setThinkingInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [stats, setStats] = useState({ cpu: 12, memory: 38, latency: 18, temp: 34.5, stability: 99.99 });
  const [location, setLocation] = useState({ lat: '0.0000', lng: '0.0000', accuracy: null as number | null });
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);

  // Refs
  const sessionRef = useRef<any>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setLocation({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4), accuracy: pos.coords.accuracy }),
        () => setLocation({ lat: 'ERR_LOC', lng: 'ERR_LOC', accuracy: null }),
        { enableHighAccuracy: true }
      );
      return () => {
        navigator.geolocation.clearWatch(watchId);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const runDiagnosticAndInstall = async () => {
    if (!deferredPrompt) return;
    setInstallingStatus('diagnostic');
    setArgonState(ArgonState.SCANNING);
    
    // Simulate diagnostic check
    await new Promise(r => setTimeout(r, 2000));
    setInstallingStatus('ready');
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setArgonState(ArgonState.IDLE);
      handleTTS("Resident AI initialized. System integration successful.");
    } else {
      setInstallingStatus('idle');
      setArgonState(ArgonState.IDLE);
    }
  };

  // System telemetry simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        cpu: Math.max(5, Math.min(95, prev.cpu + (Math.random() * 8 - 4) + (argonState === ArgonState.THINKING ? 45 : 0))),
        memory: Math.max(30, Math.min(85, prev.memory + (Math.random() * 0.5 - 0.25))),
        latency: Math.max(5, Math.min(120, prev.latency + (Math.random() * 12 - 6))),
        temp: Math.max(28, Math.min(95, prev.temp + (Math.random() * 0.4 - 0.2))),
        stability: Math.max(99.75, Math.min(100, prev.stability + (Math.random() * 0.02 - 0.01)))
      }));

      if (Math.random() > 0.98 && isAuthorized) {
        const id = Math.random().toString();
        setAlerts(prev => [{ id, type: 'WARNING', message: 'Spectral drift detected in core.', category: 'STABILITY', timestamp: Date.now() }, ...prev].slice(0, 3));
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [argonState, isAuthorized]);

  const handlePasswordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === MASTER_PASSWORD) {
      setIsAuthorized(true);
      setArgonState(ArgonState.IDLE);
      initializeLiveSession();
      handleTTS(`Interface authorized. Welcome back, Master ${ADMIN_NAME}. Quantum core is online.`);
    } else {
      setAuthError("Unauthorized access attempt. Security protocols active.");
      handleTTS("Access denied.");
    }
  };

  const handleTTS = async (text: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } }
        }
      });
      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData && audioContextOutRef.current) {
        const ctx = audioContextOutRef.current;
        const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (e) { console.error("TTS Fault", e); }
  };

  const initializeLiveSession = async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => { setIsLive(true); setArgonState(ArgonState.LISTENING); },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextOutRef.current) {
              setArgonState(ArgonState.SPEAKING);
              const ctx = audioContextOutRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setArgonState(ArgonState.LISTENING);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are ARGON, a high-level JARVIS-style AI built by ZIM core. Master ${ADMIN_NAME} is your handler. Always provide deep system insights and be helpful. Use a sophisticated, professional tone.`,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error("Session Failed", e); }
  };

  const handleThinkingQuery = async () => {
    if (!thinkingInput.trim()) return;
    setIsThinking(true);
    setArgonState(ArgonState.THINKING);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: thinkingInput,
        config: { 
          thinkingConfig: { thinkingBudget: 24000 },
          tools: isWorldwideLinkActive ? [{ googleSearch: {} }] : [] 
        }
      });
      const text = response.text || "Data retrieval failure.";
      setTranscriptions(p => [
        { text: thinkingInput, sender: 'user', timestamp: Date.now() },
        { text, sender: 'argon', timestamp: Date.now() },
        ...p
      ]);
      setThinkingInput('');
    } catch (e) { console.error(e); } finally {
      setIsThinking(false);
      setArgonState(ArgonState.IDLE);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* Auth Screen Overlay */}
      {(!isAuthorized || argonState === ArgonState.OFFLINE) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl">
          <div className="bracket-card w-full max-w-sm p-12 flex flex-col items-center gap-10">
            <div className="relative h-28 w-28">
              <div className="absolute inset-0 border-[1px] border-cyan-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-[3px] border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-6 bg-cyan-500/5 rounded-full flex items-center justify-center border border-cyan-500/20">
                <div className="h-4 w-4 bg-cyan-400 rotate-45 animate-pulse"></div>
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black tracking-[0.4em] text-cyan-400 uppercase mb-2">Argon Core</h2>
              <p className="text-[10px] mono-font text-cyan-900 tracking-widest uppercase">Encryption Phase: Active</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="w-full space-y-6">
              <div className="relative">
                <input 
                  type="password" placeholder="ACCESS KEY REQUIRED" value={passwordInput} autoFocus
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-900/80 border-b-2 border-cyan-500/20 px-4 py-4 text-center text-cyan-100 placeholder:text-cyan-900 outline-none focus:border-cyan-400 transition-all font-bold tracking-[0.3em] uppercase text-sm"
                />
              </div>
              <button type="submit" className="w-full py-4 bg-cyan-600/10 border border-cyan-400/50 text-cyan-400 font-black tracking-[0.4em] uppercase transition-all hover:bg-cyan-500 hover:text-white shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                Initialize
              </button>
            </form>
            {authError && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest text-center animate-pulse">{authError}</p>}
          </div>
        </div>
      )}

      {/* Header HUD */}
      <header className="h-16 flex items-center justify-between px-10 border-b border-cyan-500/10 bg-slate-950/60 backdrop-blur-md z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-sm rotate-45 ${isAuthorized ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]' : 'bg-red-500'}`}></div>
            <span className="text-sm font-black tracking-[0.5em] text-cyan-400 uppercase">Argon</span>
          </div>
          <div className="h-6 w-[1px] bg-cyan-500/10"></div>
          <div className="flex gap-4">
            <span className="text-[9px] mono-font text-cyan-800 tracking-widest uppercase">Admin: {ADMIN_NAME}</span>
            <span className="text-[9px] mono-font text-cyan-800 tracking-widest uppercase">Sec_Level: 07</span>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="hidden lg:flex gap-8">
            <HeaderStat label="Neural_Load" value={`${stats.cpu.toFixed(0)}%`} />
            <HeaderStat label="Stability" value={`${stats.stability.toFixed(2)}%`} />
            <HeaderStat label="Thermals" value={`${stats.temp.toFixed(1)}°C`} critical={stats.temp > 80} />
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="group flex items-center gap-2 px-4 py-2 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <span className="h-2 w-2 bg-red-500 rounded-full group-hover:animate-ping"></span>
            Purge Session
          </button>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="flex-1 flex gap-5 p-5 overflow-hidden">
        
        {/* Left Side: System Vision & Control */}
        <div className="w-[350px] flex flex-col gap-5">
          {/* Vision Feed Panel with Holographic Wrapping Border */}
          <div className="hud-panel rounded-xl vision-container">
            <div className="vision-inner-shield p-4">
              <div className="flex justify-between items-center mb-3 px-1">
                <span className="text-[10px] font-black text-cyan-500/60 uppercase tracking-[0.3em]">Optic_Buffer</span>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] mono-font text-cyan-900">4K_RES</span>
                  <div className="flex gap-[2px]">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className={`w-1 h-2 ${i < 5 ? 'bg-cyan-400' : 'bg-cyan-900'}`}></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-cyan-500/30">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover opacity-80" />
                <div className="target-reticle"></div>
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-2 py-1 rounded text-[8px] border border-cyan-500/20 mono-font">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                  VIS_UPLINK:ACTIVE
                </div>
                <div className="absolute bottom-3 left-3 text-[8px] mono-font text-cyan-400 bg-black/40 p-1.5 rounded border border-white/5">
                  [{location.lat}, {location.lng}]
                </div>
              </div>
            </div>
          </div>

          {/* Control Tabs */}
          <div className="flex-1 hud-panel rounded-xl overflow-hidden flex flex-col">
            <div className="flex border-b border-cyan-500/10 bg-cyan-500/5">
              {['cognition', 'network', 'deployment'].map(t => (
                <button 
                  key={t} onClick={() => setActiveTab(t as any)}
                  className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === t ? 'text-cyan-400' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  {t}
                  {activeTab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_10px_cyan]"></div>}
                </button>
              ))}
            </div>
            <div className="p-6 flex-1 overflow-y-auto data-flow-bg custom-scrollbar">
              {activeTab === 'cognition' && (
                <div className="space-y-5">
                  <div className="flex justify-between items-center text-[10px] mono-font text-cyan-900 uppercase font-black">
                    <span>Grounding_Stream</span>
                    <button onClick={() => setIsWorldwideLinkActive(!isWorldwideLinkActive)} className={`px-2 py-0.5 border ${isWorldwideLinkActive ? 'border-green-500/50 text-green-500' : 'border-slate-800 text-slate-700'} rounded`}>
                      {isWorldwideLinkActive ? 'GLOBAL_LINK' : 'LOCAL_HOST'}
                    </button>
                  </div>
                  <textarea 
                    value={thinkingInput} onChange={(e) => setThinkingInput(e.target.value)}
                    placeholder="INITIATE COMMAND SEQUENCE..."
                    className="w-full h-40 bg-slate-950/40 border border-cyan-500/10 rounded-lg p-4 text-xs text-cyan-100 mono-font outline-none focus:border-cyan-500/50 transition-all resize-none shadow-inner"
                  />
                  <button 
                    onClick={handleThinkingQuery} disabled={isThinking}
                    className="w-full py-4 bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-black tracking-[0.4em] uppercase hover:bg-cyan-500 hover:text-white transition-all shadow-[0_0_20px_rgba(34,211,238,0.1)]"
                  >
                    {isThinking ? 'Processing_Neural_Array...' : 'Execute_Query'}
                  </button>
                </div>
              )}
              {activeTab === 'network' && (
                <div className="space-y-3">
                   {linkedDevices.map(d => (
                     <div key={d.id} className="bracket-card p-3 flex items-center justify-between group cursor-crosshair">
                       <div className="flex flex-col">
                         <span className="text-[10px] font-black text-cyan-100 uppercase tracking-widest">{d.name}</span>
                         <span className="text-[8px] mono-font text-cyan-800 uppercase tracking-tighter">NODE_{d.type}</span>
                       </div>
                       <div className={`h-1.5 w-10 rounded-full ${d.isPowered ? 'bg-cyan-400' : 'bg-red-900'}`}></div>
                     </div>
                   ))}
                </div>
              )}
              {activeTab === 'deployment' && (
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-widest border-b border-cyan-500/10 pb-2">Resident Software Setup</h4>
                  
                  {deferredPrompt && (
                    <button 
                      onClick={runDiagnosticAndInstall}
                      className="w-full py-4 mb-4 bg-cyan-500/20 border border-cyan-400 text-cyan-400 font-black tracking-[0.3em] uppercase hover:bg-cyan-400 hover:text-white transition-all overflow-hidden relative"
                    >
                      {installingStatus === 'diagnostic' ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          RUNNING_DIAGNOSTIC...
                        </div>
                      ) : (
                        "Initialize Resident AI"
                      )}
                    </button>
                  )}

                  <div className="bracket-card bg-cyan-500/5 p-4 space-y-4">
                    <div className="flex gap-3">
                      <span className="h-5 w-5 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px] font-black text-cyan-400">01</span>
                      <p className="text-[9px] text-cyan-100 uppercase tracking-tight leading-relaxed">System Initialization: Run the Resident AI installer above to create a dedicated OS bridge.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="h-5 w-5 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px] font-black text-cyan-400">02</span>
                      <p className="text-[9px] text-cyan-100 uppercase tracking-tight leading-relaxed">Taskbar Persistence: After installation, right-click the ARGON icon in your Windows Taskbar and select "Pin to Taskbar".</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="h-5 w-5 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px] font-black text-cyan-400">03</span>
                      <p className="text-[9px] text-cyan-100 uppercase tracking-tight leading-relaxed">Background Auth: For silent operation, ensure "Always Allow" permissions are set for microphone and camera in Windows Privacy Settings.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Neural Core Visualization */}
        <div className="flex-1 flex flex-col gap-5 relative">
          <div className="flex-1 hud-panel rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <div className="h-[700px] w-[700px] border-[50px] border-cyan-500/10 rounded-full"></div>
              <div className="absolute h-[500px] w-[500px] border border-cyan-500/5 rounded-full"></div>
              <div className="absolute h-[300px] w-[300px] border-[2px] border-dashed border-cyan-500/10 rounded-full animate-spin-slow"></div>
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="relative h-80 w-80 flex items-center justify-center">
                <div className="hud-ring-outer absolute inset-0 border-[4px] border-dashed border-cyan-500/20 rounded-full"></div>
                <div className="hud-ring-mid absolute inset-10 border-[2px] border-cyan-400/10 border-t-cyan-400/60 rounded-full"></div>
                <div className="hud-ring-inner absolute inset-20 border-[1px] border-cyan-400/30 border-b-cyan-400 rounded-full"></div>
                
                <div className={`hud-core-pulse h-44 w-44 rounded-full border border-cyan-400/40 flex flex-col items-center justify-center bg-cyan-500/5 backdrop-blur-sm transition-all shadow-[0_0_50px_rgba(34,211,238,0.1)] ${argonState === ArgonState.SPEAKING ? 'scale-110 border-cyan-400' : 'scale-100'}`}>
                   <span className="text-[10px] font-black text-cyan-800 uppercase tracking-[0.4em] mb-2">Core_Pulse</span>
                   <span className="text-xl font-black text-cyan-400 uppercase tracking-[0.2em]">{argonState}</span>
                </div>
              </div>

              <div className="mt-16 grid grid-cols-2 gap-x-20 gap-y-8 w-full max-w-lg px-8">
                <Readout label="Neural_Array" value={`${stats.cpu.toFixed(0)}%`} alert={stats.cpu > 85} />
                <Readout label="Quantum_Temp" value={`${stats.temp.toFixed(1)}°C`} alert={stats.temp > 85} />
                <Readout label="Mem_Pool" value={`${stats.memory.toFixed(1)}GB`} />
                <Readout label="Sync_Rate" value={`${stats.stability.toFixed(2)}%`} />
              </div>
            </div>

            <div className="absolute top-8 right-8 flex flex-col gap-4 z-20">
              {alerts.map(a => (
                <div key={a.id} className={`p-4 rounded-lg border text-[11px] font-black w-64 flex justify-between items-start backdrop-blur-md ${a.type === 'CRITICAL' ? 'bg-red-950/40 border-red-500 text-red-400 critical-glitch' : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-400'}`}>
                  <div className="flex flex-col">
                    <span className="uppercase text-[8px] mb-1 opacity-60">System_Event</span>
                    <span>{a.message}</span>
                  </div>
                  <button onClick={() => setAlerts(p => p.filter(al => al.id !== a.id))} className="ml-2 text-cyan-800 hover:text-cyan-400 font-bold transition-all">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="h-24 hud-panel rounded-xl flex items-center px-8 gap-8">
            <div className="relative h-14 w-14 flex items-center justify-center">
              <div className={`absolute inset-0 border border-cyan-500/30 rounded-full ${argonState === ArgonState.LISTENING ? 'animate-ping' : ''}`}></div>
              <div className="h-6 w-6 rounded-sm bg-cyan-400 rotate-45"></div>
            </div>
            <div className="flex-1 flex flex-col">
              <span className="text-[10px] font-black text-cyan-900 uppercase tracking-[0.4em] mb-2">Spectral_Telemetry_Log</span>
              <p className="text-sm text-cyan-100 mono-font truncate font-bold">
                {isAuthorized ? `[${new Date().toLocaleTimeString()}] UPLINK: OK // MODE: MULTIMODAL` : 'AWAITING_INPUT_SIGNAL_...'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Conversation Log */}
        <div className="w-[450px] flex flex-col hud-panel rounded-xl overflow-hidden border-cyan-500/20 shadow-2xl">
          <div className="bg-cyan-500/5 px-6 py-5 border-b border-cyan-500/10 flex justify-between items-center">
             <div className="flex items-center gap-3">
               <div className="h-2 w-2 bg-cyan-400 rounded-full animate-pulse"></div>
               <span className="text-[11px] font-black text-cyan-400 uppercase tracking-[0.4em]">Comms_Array</span>
             </div>
             <span className="text-[8px] mono-font text-cyan-900 font-black uppercase">Buffer_Size: 2048KB</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col-reverse gap-5 scroll-smooth custom-scrollbar">
            {transcriptions.length === 0 ? (
              <div className="h-full flex items-center justify-center opacity-20 flex-col gap-4 grayscale">
                <div className="h-16 w-16 border-[2px] border-dashed border-cyan-500 rounded-full animate-spin-slow"></div>
                <span className="text-[10px] mono-font uppercase tracking-[0.3em] font-black">Scanning...</span>
              </div>
            ) : (
              transcriptions.map((t, i) => (
                <div key={i} className={`flex flex-col ${t.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`bracket-card max-w-[90%] transition-all ${t.sender === 'user' ? 'bg-cyan-950/20 border-cyan-400/50 text-cyan-50' : 'bg-slate-900/60 border-slate-700/60 text-slate-200'}`}>
                    <div className="text-[9px] font-black uppercase mb-3 flex justify-between gap-6 opacity-40 tracking-widest">
                      <span className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${t.sender === 'user' ? 'bg-cyan-500' : 'bg-blue-600'}`}></div>
                        {t.sender === 'user' ? `[User] ${ADMIN_NAME}` : '[Sys] Argon AI'}
                      </span>
                      <span>{new Date(t.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs leading-relaxed mono-font font-medium tracking-tight selection:bg-cyan-500/30 whitespace-pre-wrap">{t.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer HUD */}
      <footer className="h-10 px-10 bg-slate-950/80 border-t border-cyan-500/10 flex items-center justify-between z-50">
        <div className="flex gap-12 text-[9px] font-black text-cyan-900 uppercase tracking-[0.3em]">
           <span className="flex items-center gap-2"><div className="h-1.5 w-1.5 bg-green-500 rounded-full"></div> Core_Nominal</span>
           <span>OS_ZIM_V3.92</span>
        </div>
        <div className="flex gap-12 text-[9px] font-black text-cyan-900 uppercase tracking-[0.3em]">
           <span className="text-cyan-600">Pos_Acc: {location.accuracy ? `${location.accuracy.toFixed(1)}m` : 'LOCKING...'}</span>
           <span className="text-cyan-400 flex items-center gap-2">
             <div className="h-1.5 w-1.5 bg-cyan-400 animate-ping rounded-full"></div>
             Uptime: {Math.floor(performance.now() / 1000)}s
           </span>
        </div>
      </footer>
    </div>
  );
};

const HeaderStat: React.FC<{ label: string, value: string, critical?: boolean }> = ({ label, value, critical }) => (
  <div className="flex flex-col items-end gap-1">
    <span className="text-[8px] font-black text-cyan-900 uppercase tracking-widest">{label}</span>
    <span className={`text-xs font-black mono-font tracking-widest ${critical ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>{value}</span>
  </div>
);

const Readout: React.FC<{ label: string, value: string, alert?: boolean }> = ({ label, value, alert }) => (
  <div className="flex flex-col group">
    <span className="text-[9px] font-black text-cyan-800 uppercase tracking-[0.3em] mb-2 group-hover:text-cyan-600 transition-colors">{label}</span>
    <div className={`text-lg font-black mono-font tracking-[0.2em] ${alert ? 'text-red-500 animate-pulse' : 'text-cyan-100'}`}>
      {value}
    </div>
    <div className="h-1.5 w-full bg-cyan-950/40 mt-2 overflow-hidden rounded-full border border-white/5">
      <div className={`h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(34,211,238,0.5)] ${alert ? 'bg-red-500' : 'bg-cyan-500'}`} style={{ width: value.includes('%') ? value : '65%' }}></div>
    </div>
  </div>
);

export default App;
