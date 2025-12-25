
import React from 'react';
import { AppStatus } from '../types';

interface HUDProps {
  status: AppStatus;
}

const HUD: React.FC<HUDProps> = ({ status }) => {
  const isSpeaking = status === AppStatus.SPEAKING;
  const isListening = status === AppStatus.LISTENING;

  return (
    <div className="relative w-[450px] h-[450px] flex items-center justify-center pointer-events-none">
      {/* Anneaux Rotatifs */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-full h-full animate-rotate-ccw opacity-10 border-[0.5px] border-dashed border-cyan-400 rounded-full" />
        <div className="absolute w-[85%] h-[85%] animate-rotate-cw opacity-30 border-[2px] border-dotted border-cyan-500/40 rounded-full" />
        <div className="absolute w-[70%] h-[70%] animate-rotate-cw-fast opacity-20 border-[1px] border-cyan-300 rounded-full border-t-transparent" />
      </div>

      {/* SVG HUD */}
      <svg viewBox="0 0 100 100" className={`absolute inset-0 w-full h-full drop-shadow-[0_0_15px_rgba(0,229,255,0.4)] ${isSpeaking ? 'animate-pulse-glow' : ''}`}>
        <circle cx="50" cy="50" r="48" fill="none" stroke="#00e5ff" strokeWidth="0.1" strokeOpacity="0.2" />
        <g className="animate-rotate-cw origin-center">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#00e5ff" strokeWidth="1.5" strokeDasharray="10 5 15 2" strokeOpacity="0.6" />
        </g>
      </svg>

      {/* Visualiseur Audio */}
      {isSpeaking && (
        <div className="absolute z-10 flex items-end justify-center gap-[2px] h-10 w-32 bottom-[40%]">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="w-[2px] bg-cyan-400 animate-bar" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      )}

      {/* Centre J.A.R.V.I.S. */}
      <div className="z-20 text-center flex flex-col items-center">
        <h1 className="text-cyan-400 font-black text-5xl tracking-tighter leading-none filter drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]">
          J.A.R.V.I.S.
        </h1>
        <div className="mt-4 h-4">
          {isSpeaking && <span className="text-[8px] text-cyan-400 font-mono tracking-[0.3em] animate-pulse">TRANSMITTING...</span>}
          {isListening && <span className="text-[8px] text-orange-400 font-mono tracking-[0.3em] animate-pulse">LISTENING...</span>}
        </div>
      </div>
    </div>
  );
};

export default HUD;
