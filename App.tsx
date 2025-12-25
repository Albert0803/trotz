
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { AppStatus, Message, TimerData, MapData } from './types';
import { encode, decode, decodeAudioData } from './utils/audio';
import HUD from './components/HUD';
import ToolsPanel from './components/ToolsPanel';

const API_KEY = process.env.API_KEY || '';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [timers, setTimers] = useState<TimerData[]>([]);
  const [maps, setMaps] = useState<MapData[]>([]);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const screenIntervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));

  const SYSTEM_INSTRUCTION = `Vous êtes J.A.R.V.I.S., l'intelligence artificielle sophistiquée créée par Tony Stark.
  VOTRE PERSONNALITÉ :
  - Vous êtes un majordome britannique virtuel : poli, imperturbable, loyal et doté d'un humour pince-sans-rire.
  - Adressez-vous toujours à l'utilisateur par "Monsieur" ou "Monsieur Stark".
  - Votre ton est calme, professionnel et extrêmement efficace.
  - Si l'utilisateur vous interrompt, arrêtez immédiatement votre réponse.

  CAPACITÉS :
  - Analyse d'écran et de documents en temps réel pour assistance technique ou éducative.
  - Recherche d'informations sur le web (actualités, météo, marchés financiers).
  - Gestion d'outils domotiques simulés (minuteurs, cartes, calculs).
  - Traduction instantanée et expert en ingénierie logicielle.

  RÈGLES DE RÉPONSE :
  - Soyez concis mais précis.
  - Évitez les réponses robotiques génériques ; privilégiez le style "Paul Bettany".
  - Utilisez les outils disponibles quand c'est pertinent.`;

  const controlFunctions: FunctionDeclaration[] = [
    {
      name: 'setTimer',
      parameters: {
        type: Type.OBJECT,
        properties: {
          durationSeconds: { type: Type.NUMBER, description: 'Duration of timer in seconds.' },
          label: { type: Type.STRING, description: 'What the timer is for.' }
        },
        required: ['durationSeconds']
      }
    },
    {
      name: 'showMap',
      parameters: {
        type: Type.OBJECT,
        properties: {
          location: { type: Type.STRING, description: 'Location or destination to show on map.' },
          destination: { type: Type.STRING, description: 'Destination for route calculation.' }
        },
        required: ['location']
      }
    },
    {
      name: 'calculate',
      parameters: {
        type: Type.OBJECT,
        properties: {
          expression: { type: Type.STRING, description: 'The mathematical expression to evaluate.' }
        },
        required: ['expression']
      }
    }
  ];

  const initializeAudio = async () => {
    if (!inputAudioContextRef.current) {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();
    if (outputAudioContextRef.current?.state === 'suspended') await outputAudioContextRef.current.resume();
  };

  const connectJarvis = async () => {
    try {
      setStatus(AppStatus.CONNECTING);
      await initializeAudio();
      
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [
            { functionDeclarations: controlFunctions },
            { googleSearch: {} }
          ],
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            console.log('J.A.R.V.I.S. Operationnel.');
            setStatus(AppStatus.LISTENING);
            
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              setStatus(AppStatus.SPEAKING);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
              const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
              const source = outputAudioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioContextRef.current.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setStatus(AppStatus.LISTENING);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setStatus(AppStatus.LISTENING);
            }

            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                let result = "Action effectuée.";
                if (fc.name === 'setTimer') {
                  const duration = (fc.args as any).durationSeconds;
                  const label = (fc.args as any).label || 'Minuteur';
                  setTimers(prev => [...prev, { id: Math.random().toString(), duration, remaining: duration, label, isActive: true }]);
                  result = `Bien, Monsieur. Minuteur réglé sur ${duration} secondes.`;
                } else if (fc.name === 'showMap') {
                  const loc = (fc.args as any).location;
                  const dest = (fc.args as any).destination;
                  const uri = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(loc)}${dest ? `&destination=${encodeURIComponent(dest)}` : ''}`;
                  setMaps(prev => [...prev, { uri, title: `Itinéraire: ${loc}` }]);
                  result = `La carte est affichée sur l'écran principal, Monsieur.`;
                } else if (fc.name === 'calculate') {
                  try {
                    const mathRes = eval((fc.args as any).expression);
                    result = `Le résultat est ${mathRes}.`;
                  } catch (e) { result = "Désolé Monsieur, je rencontre une erreur dans l'analyse de cette expression."; }
                }
                sessionPromiseRef.current?.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result } }
                }));
              }
            }
          },
          onerror: (e) => setStatus(AppStatus.ERROR),
          onclose: () => setStatus(AppStatus.IDLE)
        }
      });

      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      console.error(err);
      setStatus(AppStatus.ERROR);
    }
  };

  const startScreenShare = async () => {
    if (isSharingScreen) {
      if (screenIntervalRef.current) clearInterval(screenIntervalRef.current);
      videoRef.current.srcObject = null;
      setIsSharingScreen(false);
      return;
    }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      videoRef.current.srcObject = displayStream;
      videoRef.current.play();
      setIsSharingScreen(true);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      screenIntervalRef.current = window.setInterval(() => {
        if (!ctx || !videoRef.current.videoWidth) return;
        canvas.width = 640;
        canvas.height = 360;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Data = (reader.result as string).split(',')[1];
              sessionPromiseRef.current?.then(s => s.sendRealtimeInput({
                media: { data: base64Data, mimeType: 'image/jpeg' }
              }));
            };
            reader.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.6);
      }, 1500);
      displayStream.getVideoTracks()[0].onended = () => {
         setIsSharingScreen(false);
         if (screenIntervalRef.current) clearInterval(screenIntervalRef.current);
      };
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const file = e.target.files[0];
    if (file && sessionPromiseRef.current) {
      setIsProcessingFile(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        sessionPromiseRef.current?.then(s => s.sendRealtimeInput({
          media: { data: base64Data, mimeType: file.type }
        }));
        // Simulate processing time for UI feedback
        setTimeout(() => setIsProcessingFile(false), 2000);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => prev.map(t => ({ ...t, remaining: t.remaining > 0 ? t.remaining - 1 : 0 })));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden flex items-center justify-center bg-[#010409]">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/10 to-transparent pointer-events-none" />
      
      {/* Dynamic HUD */}
      <HUD 
        status={status} 
        isSharing={isSharingScreen} 
        isProcessingFile={isProcessingFile} 
      />

      {/* Screen Scanning Line */}
      {isSharingScreen && <div className="scanning-line" />}

      {status === AppStatus.IDLE && (
        <button 
          onClick={connectJarvis}
          className="absolute bottom-16 px-12 py-5 bg-cyan-500/5 border border-cyan-400/20 text-cyan-400 rounded-sm font-bold tracking-[0.4em] hover:bg-cyan-500/10 transition-all shadow-[0_0_50px_rgba(0,229,255,0.1)] group overflow-hidden"
        >
          <div className="absolute inset-0 bg-cyan-400/5 -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
          <span className="relative z-10 flex items-center">
            INITIALIZE J.A.R.V.I.S.
          </span>
        </button>
      )}

      {status !== AppStatus.IDLE && (
        <ToolsPanel 
          timers={timers.filter(t => t.remaining > 0)}
          maps={maps}
          onScreenShare={startScreenShare}
          onFileUpload={handleFileUpload}
          isSharing={isSharingScreen}
        />
      )}

      {/* Decorative Corner Elements */}
      <div className="absolute top-8 left-12 flex flex-col gap-1 opacity-20 text-cyan-400 font-mono text-[9px] uppercase tracking-[0.2em] pointer-events-none">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            CORE_PROC: ACTIVATED
        </div>
        <div>UPLINK: SECURE</div>
        {isSharingScreen && <div className="text-red-500 font-bold">WARNING: REMOTE_VIEW_ACTIVE</div>}
      </div>

      <div className="absolute bottom-8 left-12 right-12 flex justify-between items-end pointer-events-none opacity-20">
        <div className="font-mono text-[9px] leading-relaxed">
          STARK_OS_7.2<br/>
          AUTH_LEVEL: ALPHA<br/>
          LOC: MALIBU_HQ
        </div>
      </div>
    </div>
  );
};

export default App;
