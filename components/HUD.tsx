
import React from 'react';
import { AppStatus } from '../types';

interface HUDProps {
  status: AppStatus;
  isSharing: boolean;
  isProcessingFile: boolean;
}

const HUD: React.FC<HUDProps> = ({ status, isSharing, isProcessingFile }) => {
  const isSpeaking = status === AppStatus.SPEAKING;
  const isListening = status === AppStatus.LISTENING;

  return (
    <div className="relative w-[600px] h-[600px] flex items-center justify-center">
      {/* Background Hex Pattern - Resized from 520 to 390 */}
      <div className="absolute w-[390px] h-[390px] rounded-full overflow-hidden opacity-20 hex-pattern" 
           style={{ maskImage: 'radial-gradient(circle, black 60%, transparent 100%)' }} />

      {/* Rotating Ring Components */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Outer slow CCW */}
        <div className="absolute w-[98%] h-[98%] animate-rotate-ccw opacity-30 border-[0.5px] border-dashed border-cyan-400 rounded-full" />
        {/* Medium fast CW */}
        <div className="absolute w-[88%] h-[88%] animate-rotate-cw opacity-60 border-[2px] border-dotted border-cyan-500/40 rounded-full" />
        {/* Inner fast CW */}
        <div className="absolute w-[74%] h-[74%] animate-rotate-cw-fast opacity-40 border-[1px] border-cyan-300 rounded-full border-t-transparent border-l-transparent" />
      </div>

      {/* Main HUD SVG - Scales automatically with container */}
      <svg viewBox="0 0 100 100" className={`absolute inset-0 w-full h-full drop-shadow-[0_0_15px_rgba(0,229,255,0.6)] ${isSpeaking ? 'animate-pulse-glow' : ''}`}>
        {/* Outer Fine Ring */}
        <circle cx="50" cy="50" r="48" fill="none" stroke="#00e5ff" strokeWidth="0.2" strokeOpacity="0.4" />
        
        {/* Thick Segmented Ring - ROTATING via CSS */}
        <g className="animate-rotate-cw origin-center">
          <circle 
            cx="50" cy="50" r="44" 
            fill="none" 
            stroke="#00e5ff" 
            strokeWidth="2.5" 
            strokeDasharray="15 3 40 5 20 8 30 2" 
            strokeOpacity="0.9" 
          />
        </g>

        {/* Medium Segmented Ring - ROTATING CCW */}
        <g className="animate-rotate-ccw origin-center">
          <circle 
            cx="50" cy="50" r="40" 
            fill="none" 
            stroke="#00e5ff" 
            strokeWidth="0.8" 
            strokeDasharray="5 2 10 3" 
            strokeOpacity="0.7" 
          />
        </g>

        {/* Ticks/Markings */}
        <g opacity="0.6" className="animate-rotate-cw origin-center" style={{ animationDuration: '60s' }}>
          {[...Array(60)].map((_, i) => (
            <line 
              key={i}
              x1="50" y1="12" x2="50" y2="14"
              stroke="#00e5ff"
              strokeWidth="0.3"
              transform={`rotate(${i * 6} 50 50)`}
            />
          ))}
        </g>
      </svg>

      {/* Audio Visualizer (Music Player Style) - Resized height */}
      {isSpeaking && (
        <div className="absolute z-10 flex items-end justify-center gap-[2px] h-16 w-48 bottom-[35%] opacity-80">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="w-[2px] bg-cyan-400 animate-bar"
              style={{ 
                animationDelay: `${i * 0.05}s`,
                boxShadow: '0 0 8px rgba(0,229,255,0.5)'
              }}
            />
          ))}
        </div>
      )}

      {/* Central Content - Resized text from 8xl to 6xl */}
      <div className={`z-20 text-center select-none transition-all duration-500 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
        <h1 className="text-[#00e5ff] font-black text-6xl tracking-tighter leading-none glow-cyan" style={{ fontFamily: '"Arial Black", sans-serif' }}>
          J.A.R.V.I.S.
        </h1>
        <p className="text-[#00e5ff] text-[10px] font-bold tracking-[0.1em] mt-2 opacity-90 uppercase">
          Just A Rather Very Intelligent System.
        </p>
        
        <div className="mt-6 flex items-center justify-center gap-1 h-4">
          {isSpeaking && (
             <div className="text-[8px] text-cyan-400 font-mono animate-pulse uppercase tracking-widest bg-cyan-900/20 px-2 py-1 border border-cyan-400/30 rounded">
               [ TRANSMITTING ]
             </div>
          )}
          {isListening && (
             <div className="text-[8px] text-orange-400 font-mono animate-pulse uppercase tracking-widest">
               [ LISTENING ]
             </div>
          )}
        </div>
      </div>

      {/* Side Status Indicators */}
      <div className="absolute left-[15%] top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-50">
        <div className={`h-1 w-10 rounded-full ${isSharing ? 'bg-red-500 animate-pulse' : 'bg-cyan-900'}`} />
        <div className={`h-1 w-6 rounded-full ${isProcessingFile ? 'bg-yellow-500 animate-pulse' : 'bg-cyan-900'}`} />
        <div className="h-1 w-8 rounded-full bg-cyan-900" />
      </div>

      {/* Serial ID */}
      <div className="absolute bottom-[12%] text-[#00e5ff] font-mono text-xs tracking-[0.4em] opacity-80">
        1 B62825
      </div>

      {/* Floating UI Context Labels */}
      <div className="absolute w-[80%] h-[80%] pointer-events-none opacity-40">
        <div className="absolute top-0 left-0 font-mono text-[7px] text-cyan-400 flex flex-col">
            <span>SYS_V: 10.4.2</span>
            {isSharing && <span className="text-red-500 font-bold mt-1">VISION_SYS: ON</span>}
        </div>
        <div className="absolute top-0 right-0 font-mono text-[7px] text-cyan-400 text-right">
            <span>NET_STAT: OK</span>
            {isProcessingFile && <span className="text-yellow-400 mt-1 block animate-pulse">INGESTING_FILE</span>}
        </div>
        <div className="absolute bottom-0 left-0 font-mono text-[7px] text-cyan-400">GRID_REF: S-99</div>
        <div className="absolute bottom-0 right-0 font-mono text-[7px] text-cyan-400">UI_MODE: STARK_INT</div>
      </div>
    </div>
  );
};

export default HUD;
