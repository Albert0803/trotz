
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { AppStatus, TimerData, DisplayedContent } from './types';
import { encode, decode, decodeAudioData } from './utils/audio';
import HUD from './components/HUD';
import ToolsPanel from './components/ToolsPanel';
import DataDisplay from './components/DataDisplay';

// Config PDF.js
if (typeof window !== 'undefined' && 'pdfjsLib' in window) {
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

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
          title: { type: Type.STRING, description: 'Titre de la fenêtre.' },
          content: { type: Type.STRING, description: 'Contenu textuel, synthèse ou code.' },
          type: { type: Type.STRING, enum: ['text', 'code', 'correction'], description: 'Type de formatage.' }
        },
        required: ['title', 'content', 'type']
      }
    }
  ];

  const connect = async () => {
    try {
      setStatus(AppStatus.CONNECTING);
      
      // Initialisation ou reprise des contextes audio
      if (!inputCtxRef.current) {
        inputCtxRef.current = new AudioContext({ sampleRate: 16000 });
        outputCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      
      // IMPORTANT: Reprendre le contexte suite à l'interaction utilisateur pour éviter le mode muet
      if (inputCtxRef.current.state === 'suspended') await inputCtxRef.current.resume();
      if (outputCtxRef.current.state === 'suspended') await outputCtxRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          systemInstruction: "Vous êtes J.A.R.V.I.S., l'IA de Tony Stark. Comportez-vous comme un majordome britannique sophistiqué. Appelez l'utilisateur 'Monsieur'. Vous recevez des flux audio, des images et des messages texte contenant le contenu de documents (PDF, Word, PPTX). 1. Lorsqu'un contenu de document vous est envoyé, analysez-le immédiatement. 2. Utilisez 'displayContent' pour afficher une synthèse ou une version corrigée. 3. Commentez vocalement vos trouvailles avec votre flegme habituel. Soyez concis et élégant.",
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
              sessionPromise.then(s => {
                if (s) s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(processor);
            processor.connect(inputCtxRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio && outputCtxRef.current) {
              setStatus(AppStatus.SPEAKING);
              
              // S'assurer que le contexte est actif
              if (outputCtxRef.current.state === 'suspended') await outputCtxRef.current.resume();
              
              // Calcul du temps de démarrage pour un flux sans coupure
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime);
              
              try {
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
              } catch (err) {
                console.error("Erreur de décodage audio:", err);
              }
            }
            
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'setTimer') {
                  setTimers(prev => [...prev, { id: Math.random().toString(), duration: fc.args.duration, remaining: fc.args.duration, label: fc.args.label || 'Minuteur', isActive: true }]);
                  sessionRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: 'OK' } }] });
                } else if (fc.name === 'displayContent') {
                  setDisplayedContent({ title: fc.args.title, content: fc.args.content, type: fc.args.type });
                  sessionRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { result: 'Affiché.' } }] });
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
          onclose: () => {
            setStatus(AppStatus.IDLE);
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { 
      console.error(e);
      setStatus(AppStatus.ERROR); 
    }
  };

  const processDocx = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const processPptx = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await (window as any).JSZip.loadAsync(arrayBuffer);
    let fullText = "";
    const slideFiles = Object.keys(zip.files).filter(name => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"));
    
    for (const fileName of slideFiles) {
      const content = await zip.files[fileName].async("text");
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, "text/xml");
      const texts = xmlDoc.getElementsByTagName("a:t");
      fullText += `--- Slide ${fileName.match(/\d+/)?.[0]} ---\n`;
      for (let i = 0; i < texts.length; i++) {
        fullText += (texts[i].textContent || "") + " ";
      }
      fullText += "\n\n";
    }
    return fullText;
  };

  const processPDF = async (file: File) => {
    const pdfjsLib = (window as any).pdfjsLib;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.height = viewport.height; canvas.width = viewport.width;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      if (sessionRef.current) {
        sessionRef.current.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } });
      }
    }
    return "PDF_SCAN_COMPLETED";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionRef.current) return;
    setIsProcessingFile(true);
    try {
      let extractedText = "";
      if (file.type === 'application/pdf') {
        await processPDF(file);
      } else if (file.name.endsWith('.docx')) {
        extractedText = await processDocx(file);
      } else if (file.name.endsWith('.pptx')) {
        extractedText = await processPptx(file);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = (ev.target?.result as string).split(',')[1];
          sessionRef.current.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } });
        };
        reader.readAsDataURL(file);
      }

      if (extractedText) {
        sessionRef.current.sendRealtimeInput([{ 
          text: `Monsieur télécharge un fichier nommé ${file.name}. Voici son contenu : \n\n ${extractedText}` 
        }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsProcessingFile(false), 3000);
      e.target.value = '';
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
      }, 3000);
    } catch (e) { console.error(e); }
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
        <button onClick={connect} className="mt-12 px-12 py-4 border-2 border-cyan-400 text-cyan-400 font-bold tracking-[0.4em] hover:bg-cyan-400 hover:text-black transition-all animate-pulse-glow z-50 bg-cyan-400/5 shadow-[0_0_20px_rgba(0,229,255,0.2)]">
          INITIALISER J.A.R.V.I.S.
        </button>
      )}
      {status !== AppStatus.IDLE && (
        <ToolsPanel timers={timers} onScreenShare={shareScreen} isSharing={isSharingScreen} onFileUpload={handleFileUpload} />
      )}
      <div className="absolute bottom-10 left-10 opacity-40 text-[10px] font-mono text-cyan-400 space-y-1 z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status !== AppStatus.IDLE ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`}></div>
          STARK_SYSTEM_v7.6.2_AUDIO_REPAIRED
        </div>
        <div className="pl-4">OUTPUT_MODE: SPEAKER_UPLINK_STABLE</div>
        {isProcessingFile && <div className="pl-4 text-yellow-400 animate-pulse">ANALYZING_DOCUMENTS...</div>}
      </div>
    </div>
  );
};

export default App;
