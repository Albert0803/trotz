
import React from 'react';
import { AppStatus } from '../types';

interface HUDProps {
  status: AppStatus;
  isProcessing?: boolean;
}

const HUD: React.FC<HUDProps> = ({ status, isProcessing }) => {
  const isSpeaking = status === AppStatus.SPEAKING;
  const isListening = status === AppStatus.LISTENING;

  return (
    <div className="relative w-[450px] h-[450px] flex items-center justify-center pointer-events-none">
      {/* Anneaux Rotatifs */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-full h-full animate-rotate-ccw opacity-10 border-[0.5px] border-dashed border-cyan-400 rounded-full" />
        <div className="absolute w-[85%] h-[85%] animate-rotate-cw opacity-30 border-[2px] border-dotted border-cyan-500/40 rounded-full" />
        <div className="absolute w-[72%] h-[72%] animate-rotate-cw-fast opacity-20 border-[1px] border-cyan-300 rounded-full border-t-transparent shadow-[inset_0_0_50px_rgba(0,229,255,0.1)]" />
      </div>

      {/* SVG HUD */}
      <svg viewBox="0 0 100 100" className={`absolute inset-0 w-full h-full drop-shadow-[0_0_15px_rgba(0,229,255,0.4)] ${isSpeaking ? 'animate-pulse-glow' : ''}`}>
        <circle cx="50" cy="50" r="48" fill="none" stroke="#00e5ff" strokeWidth="0.1" strokeOpacity="0.2" />
        <g className="animate-rotate-cw origin-center">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#00e5ff" strokeWidth="1.2" strokeDasharray="12 4 8 2" strokeOpacity="0.6" />
        </g>
        {isProcessing && (
          <g className="animate-rotate-cw-fast origin-center">
             <circle cx="50" cy="50" r="46" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 10" strokeOpacity="0.8" />
          </g>
        )}
      </svg>

      {/* Visualiseur Audio */}
      {isSpeaking && (
        <div className="absolute z-10 flex items-end justify-center gap-[3px] h-10 w-32 bottom-[40%]">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="w-[2px] bg-cyan-400 animate-bar shadow-[0_0_5px_#00e5ff]" style={{ animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      )}

      {/* Centre J.A.R.V.I.S. */}
      <div className="z-20 text-center flex flex-col items-center">
        <div className={`transition-all duration-700 ${isSpeaking ? 'scale-110 drop-shadow-[0_0_15px_rgba(0,229,255,1)]' : 'scale-100'}`}>
          <h1 className="text-cyan-400 font-black text-5xl tracking-tighter leading-none filter">
            J.A.R.V.I.S.
          </h1>
        </div>
        <div className="mt-5 h-6 flex flex-col items-center justify-center">
          {isProcessing ? (
            <div className="flex flex-col items-center">
              <span className="text-[7px] text-yellow-400 font-mono tracking-[0.4em] animate-pulse">SCANNING_DATA...</span>
              <div className="w-16 h-[1px] bg-yellow-400/30 mt-1"></div>
            </div>
          ) : (
            <>
              {isSpeaking && <span className="text-[7px] text-cyan-400 font-mono tracking-[0.4em] animate-pulse">UPLINK_ACTIVE</span>}
              {isListening && <span className="text-[7px] text-orange-400 font-mono tracking-[0.4em] animate-pulse">AWAITING_INPUT</span>}
            </>
          )}
        </div>
      </div>

      {/* Grid Elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-cyan-400" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-cyan-400" />
      </div>
    </div>
  );
};

export default HUD;
