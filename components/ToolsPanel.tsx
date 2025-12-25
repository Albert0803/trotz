
import React from 'react';
import { TimerData, MapData } from '../types';

interface ToolsPanelProps {
  timers: TimerData[];
  maps: MapData[];
  onScreenShare: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSharing: boolean;
}

const ToolsPanel: React.FC<ToolsPanelProps> = ({ timers, maps, onScreenShare, onFileUpload, isSharing }) => {
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50">
      {/* Actions */}
      <div className="bg-cyan-950/20 backdrop-blur-md p-3 rounded-2xl flex flex-col gap-4 shadow-2xl border border-cyan-500/10">
        <button 
          onClick={onScreenShare}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all relative overflow-hidden group ${isSharing ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20'}`}
          title="Share Screen (Jarvis Vision)"
        >
          {isSharing && <div className="absolute inset-0 bg-red-500/10 animate-ping" />}
          <i className={`fas ${isSharing ? 'fa-stop' : 'fa-desktop'} z-10`}></i>
        </button>
        
        <label className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center cursor-pointer hover:bg-cyan-500/20 border border-cyan-500/20 transition-all group" title="Upload Files/Photos">
          <i className="fas fa-file-arrow-up group-hover:-translate-y-1 transition-transform"></i>
          <input type="file" className="hidden" onChange={onFileUpload} multiple />
        </label>
      </div>

      {/* Active Data Display */}
      {(timers.length > 0 || maps.length > 0) && (
        <div className="bg-cyan-950/40 backdrop-blur-xl p-4 rounded-2xl w-64 max-h-[60vh] overflow-y-auto shadow-2xl space-y-4 border border-cyan-500/20">
          {timers.length > 0 && (
            <div>
              <h3 className="text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2 border-b border-cyan-500/20 pb-1">Active Timers</h3>
              <div className="space-y-2">
                {timers.map(t => (
                  <div key={t.id} className="bg-cyan-900/20 p-2 rounded border border-cyan-500/10 flex justify-between items-center animate-in slide-in-from-right-2 duration-300">
                    <span className="text-[10px] text-slate-300 truncate w-24">{t.label || 'Timer'}</span>
                    <span className="text-cyan-400 font-mono text-sm">{Math.floor(t.remaining / 60)}:{(t.remaining % 60).toString().padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {maps.length > 0 && (
            <div>
              <h3 className="text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2 border-b border-cyan-500/20 pb-1">Navigation / Maps</h3>
              <div className="space-y-2">
                {maps.map((m, i) => (
                  <a key={i} href={m.uri} target="_blank" rel="noopener noreferrer" className="block bg-cyan-900/20 p-2 rounded border border-cyan-500/10 hover:bg-cyan-500/30 transition-all group animate-in slide-in-from-right-4 duration-500">
                    <div className="text-[10px] text-cyan-300 font-medium truncate flex items-center gap-1">
                        <i className="fas fa-location-dot text-[8px]"></i>
                        {m.title}
                    </div>
                    <div className="text-[8px] text-slate-500 truncate group-hover:text-cyan-500/50">Open Google Maps <i className="fas fa-external-link-alt text-[6px]"></i></div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolsPanel;
