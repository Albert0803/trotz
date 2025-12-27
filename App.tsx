
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { AppStatus, TimerData, DisplayedContent } from './types';
import { encode, decode, decodeAudioData } from './utils/audio';
import HUD from './components/HUD';
import ToolsPanel from './components/ToolsPanel';
import DataDisplay from './components/DataDisplay';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [timers, setTimers] = useState<TimerData[]>([]);
  const [displayedContent, setDisplayedContent] = useState<DisplayedContent | null>(null);
  
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const screenIntervalRef = useRef<number | null>(null);

  const functions: FunctionDeclaration[] = [
    {
      name: 'setTimer',
      parameters: {
        type: Type.OBJECT,
        properties: {
          duration: { type: Type.NUMBER, description: 'Durée en secondes.' },
          label: { type: Type.STRING, description: 'Libellé du minuteur.' }
        },
        required: ['duration']
      }
    },
    {
      name: 'displayContent',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Titre de la fenêtre (ex: Analyse de document, Correction Code).' },
          content: { type: Type.STRING, description: 'Le texte intégral, le code corrigé ou l\'analyse à afficher.' },
          type: { type: Type.STRING, enum: ['text', 'code', 'correction'], description: 'Nature du contenu.' }
        },
        required: ['title', 'content', 'type']
      }
    }
  ];

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
          systemInstruction: "Vous êtes J.A.R.V.I.S., l'IA de Tony Stark. Soyez poli (Monsieur), britannique et brillant. Lorsqu'un fichier image ou une capture d'écran vous est envoyé : 1. Analysez-le immédiatement. 2. Utilisez l'outil 'displayContent' pour afficher une transcription, une correction ou une analyse détaillée sur l'interface de Monsieur. 3. Expliquez vocalement ce que vous avez trouvé. Si on vous demande de corriger un texte ou du code, affichez la version corrigée dans la fenêtre de contenu.",
          tools: [{ functionDeclarations: functions }, { googleSearch: {} }]
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
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'setTimer') {
                  const args = fc.args as any;
                  setTimers(prev => [...prev, { id: Math.random().toString(), duration: args.duration, remaining: args.duration, label: args.label || 'Minuteur', isActive: true }]);
                  sessionRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: 'OK' } }] });
                } else if (fc.name === 'displayContent') {
                  const args = fc.args as any;
                  setDisplayedContent({ title: args.title, content: args.content, type: args.type });
                  sessionRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: 'Contenu affiché avec succès.' } }] });
                }
              }
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setStatus(AppStatus.LISTENING);
            }
          },
          onerror: (e) => {
            console.error('Session Error:', e);
            setStatus(AppStatus.ERROR);
          },
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
        if (!ctx || !videoRef.current.videoWidth) return;
        canvas.width = 800; canvas.height = 450;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob && sessionRef.current) {
            const reader = new FileReader();
            reader.onload = () => sessionRef.current.sendRealtimeInput({ media: { data: (reader.result as string).split(',')[1], mimeType: 'image/jpeg' } });
            reader.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.4);
      }, 2000);
    } catch (e) { console.error(e); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionRef.current) return;

    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionnement pour éviter de saturer la connexion
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        sessionRef.current.sendRealtimeInput({
          media: { data: base64, mimeType: 'image/jpeg' }
        });
        
        setTimeout(() => setIsProcessingFile(false), 3000);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    const timer = setInterval(() => setTimers(prev => prev.map(t => ({ ...t, remaining: Math.max(0, t.remaining - 1) })).filter(t => t.remaining > 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center relative bg-[#010409]">
      <HUD status={status} isProcessing={isProcessingFile} />
      
      {isSharingScreen && <div className="scanning-line" />}

      <DataDisplay data={displayedContent} onClose={() => setDisplayedContent(null)} />

      {status === AppStatus.IDLE && (
        <button 
          onClick={connect}
          className="mt-12 px-12 py-4 border-2 border-cyan-400 text-cyan-400 font-bold tracking-[0.4em] hover:bg-cyan-400 hover:text-black transition-all animate-pulse-glow z-50 bg-cyan-400/5 shadow-[0_0_20px_rgba(0,229,255,0.2)]"
        >
          INITIALISER J.A.R.V.I.S.
        </button>
      )}

      {status !== AppStatus.IDLE && (
        <ToolsPanel 
          timers={timers} 
          onScreenShare={shareScreen} 
          isSharing={isSharingScreen} 
          onFileUpload={handleFileUpload} 
        />
      )}

      <div className="absolute bottom-10 left-10 opacity-40 text-[10px] font-mono text-cyan-400 space-y-1 z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status !== AppStatus.IDLE ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`}></div>
          STARK_OS_v7.2
        </div>
        <div className="pl-4">ENCRYPTION: AES-256</div>
        {isProcessingFile && <div className="pl-4 text-yellow-400 animate-pulse">DATALINK_ACTIVE: ANALYZING_DOCUMENT...</div>}
      </div>
    </div>
  );
};

export default App;
