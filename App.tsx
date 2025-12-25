
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { AppStatus, TimerData, MapData } from './types';
import { encode, decode, decodeAudioData } from './utils/audio';
import HUD from './components/HUD';
import ToolsPanel from './components/ToolsPanel';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [timers, setTimers] = useState<TimerData[]>([]);
  
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const screenIntervalRef = useRef<number | null>(null);

  const connect = async () => {
    try {
      setStatus(AppStatus.CONNECTING);
      
      if (!inputCtxRef.current) {
        inputCtxRef.current = new AudioContext({ sampleRate: 16000 });
        outputCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          systemInstruction: "Vous êtes J.A.R.V.I.S., l'IA de Tony Stark. Soyez poli (appelez l'utilisateur Monsieur), concis et efficace.",
          tools: [{ functionDeclarations: [{
            name: 'setTimer',
            parameters: { type: Type.OBJECT, properties: { duration: { type: Type.NUMBER }, label: { type: Type.STRING } }, required: ['duration'] }
          }]}]
        },
        callbacks: {
          onopen: () => {
            setStatus(AppStatus.LISTENING);
            const source = inputCtxRef.current!.createMediaStreamSource(stream);
            const processor = inputCtxRef.current!.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const data = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(data.length);
              for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(processor);
            processor.connect(inputCtxRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio && outputCtxRef.current) {
              setStatus(AppStatus.SPEAKING);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime);
              const buffer = await decodeAudioData(decode(audio), outputCtxRef.current, 24000, 1);
              const source = outputCtxRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtxRef.current.destination);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setStatus(AppStatus.LISTENING);
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (msg.toolCall) {
              msg.toolCall.functionCalls.forEach(fc => {
                if (fc.name === 'setTimer') {
                  const args = fc.args as any;
                  setTimers(prev => [...prev, { id: Math.random().toString(), duration: args.duration, remaining: args.duration, label: args.label || 'Minuteur', isActive: true }]);
                }
              });
            }
          },
          onerror: () => setStatus(AppStatus.ERROR),
          onclose: () => setStatus(AppStatus.IDLE)
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) {
      console.error(e);
      setStatus(AppStatus.ERROR);
    }
  };

  const shareScreen = async () => {
    if (isSharingScreen) {
      if (screenIntervalRef.current) clearInterval(screenIntervalRef.current);
      setIsSharingScreen(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia();
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setIsSharingScreen(true);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      screenIntervalRef.current = window.setInterval(() => {
        if (!ctx) return;
        canvas.width = 640; canvas.height = 360;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => sessionRef.current?.sendRealtimeInput({ media: { data: (reader.result as string).split(',')[1], mimeType: 'image/jpeg' } });
            reader.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.5);
      }, 2000);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const timer = setInterval(() => setTimers(prev => prev.map(t => ({ ...t, remaining: Math.max(0, t.remaining - 1) })).filter(t => t.remaining > 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center relative">
      <HUD status={status} />
      
      {isSharingScreen && <div className="scanning-line" />}

      {status === AppStatus.IDLE && (
        <button 
          onClick={connect}
          className="mt-12 px-12 py-4 border-2 border-cyan-400 text-cyan-400 font-bold tracking-[0.4em] hover:bg-cyan-400 hover:text-black transition-all animate-pulse-glow z-50"
        >
          INITIALISER J.A.R.V.I.S.
        </button>
      )}

      {status !== AppStatus.IDLE && (
        <ToolsPanel 
          timers={timers} 
          onScreenShare={shareScreen} 
          isSharing={isSharingScreen} 
          onFileUpload={() => {}} 
        />
      )}

      <div className="absolute bottom-10 left-10 opacity-20 text-[10px] font-mono text-cyan-400 space-y-1">
        <div>CORE_v7.2_STARK_INDUSTRIES</div>
        <div>UPLINK: {status === AppStatus.IDLE ? 'STANDBY' : 'ENCRYPTED'}</div>
      </div>
    </div>
  );
};

export default App;
