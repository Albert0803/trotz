
import React from 'react';
import { DisplayedContent } from '../types';

interface DataDisplayProps {
  data: DisplayedContent | null;
  onClose: () => void;
}

const DataDisplay: React.FC<DataDisplayProps> = ({ data, onClose }) => {
  if (!data) return null;

  return (
    <div className="fixed left-8 top-1/4 w-[400px] max-h-[60vh] bg-cyan-950/20 backdrop-blur-xl border border-cyan-500/30 rounded-lg shadow-[0_0_40px_rgba(0,229,255,0.1)] overflow-hidden flex flex-col z-[150] animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="bg-cyan-500/10 border-b border-cyan-500/20 p-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-cyan-400 animate-pulse rounded-full"></div>
          <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">{data.title}</span>
        </div>
        <button onClick={onClose} className="text-cyan-500/60 hover:text-cyan-400 transition-colors">
          <i className="fas fa-times text-xs"></i>
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto font-mono text-xs text-cyan-100 leading-relaxed custom-scrollbar">
        {data.type === 'code' || data.type === 'correction' ? (
          <pre className="whitespace-pre-wrap bg-black/40 p-3 rounded border border-cyan-500/10">
            <code>{data.content}</code>
          </pre>
        ) : (
          <p className="whitespace-pre-wrap">{data.content}</p>
        )}
      </div>

      <div className="bg-cyan-500/5 p-2 flex justify-end gap-2 border-t border-cyan-500/10">
        <div className="text-[8px] text-cyan-500/40 font-mono italic">STARK_INDUSTRIES_ENCRYPTION_ACTIVE</div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 229, 255, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default DataDisplay;
