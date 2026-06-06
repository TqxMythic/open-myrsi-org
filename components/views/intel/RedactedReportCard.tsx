
import React from 'react';
import { useMembers } from '../../../contexts/MembersContext';

interface RedactedReportCardProps {
    requiredLevel?: number;
}

const RedactedReportCard: React.FC<RedactedReportCardProps> = ({ requiredLevel = 0 }) => {
    const { securityClearances } = useMembers();
    const clearance = securityClearances.find(c => c.level === requiredLevel);
    const clearanceName = clearance?.name || `LEVEL ${requiredLevel}`;

    return (
        <div className="relative bg-black border border-red-900/30 rounded-sm h-full flex flex-col overflow-hidden shadow-2xl group select-none transition-all duration-300 grayscale hover:grayscale-0">
            <div className="absolute inset-0 opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(220,38,38,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(220,38,38,0.02)_1px,transparent_1px)] bg-size-[10px_10px] pointer-events-none"></div>
            
            <div className="px-4 py-2 bg-red-950/10 border-b border-red-900/20 flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3">
                    <i className="fa-solid fa-triangle-exclamation text-red-700 text-xs animate-pulse"></i>
                    <div className="h-2 w-24 bg-red-900/20 rounded-sm animate-pulse"></div>
                </div>
                <span className="text-[8px] font-black uppercase tracking-[0.3em] font-mono text-red-900/60">
                    ACCESS_DENIED_0x004
                </span>
            </div>

            <div className="p-4 grow grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10 blur-[1.5px] opacity-20 pointer-events-none">
                <div className="md:col-span-4 space-y-4">
                    <div className="h-10 bg-red-900/20 rounded-sm w-full"></div>
                    <div className="flex gap-2">
                        <div className="h-4 w-12 bg-red-900/20 rounded-sm"></div>
                        <div className="h-4 w-20 bg-red-900/20 rounded-sm"></div>
                    </div>
                </div>
                <div className="md:col-span-8 space-y-3 md:border-l md:border-red-900/20 md:pl-6">
                     <div className="h-3 bg-red-900/20 rounded-sm w-full"></div>
                     <div className="h-3 bg-red-900/20 rounded-sm w-11/12"></div>
                     <div className="h-3 bg-red-900/20 rounded-sm w-4/5"></div>
                </div>
            </div>

            <div className="px-4 py-2 bg-black border-t border-red-900/20 flex items-center justify-between relative z-10 opacity-10">
                 <div className="h-2 w-32 bg-red-900/20 rounded-sm"></div>
                 <div className="h-2 w-16 bg-red-900/20 rounded-sm"></div>
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/40 backdrop-blur-[1px]">
                <div className="bg-black/90 border border-red-500/40 p-6 rounded-sm shadow-[0_0_50px_rgba(220,38,38,0.2)] flex flex-col items-center gap-4 transform group-hover:scale-105 transition-all duration-700 border-t-2 border-t-red-600">
                    <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-red-600/5 flex items-center justify-center text-red-500 border border-red-600/20">
                            <i className="fa-solid fa-user-secret text-2xl"></i>
                        </div>
                        <div className="absolute inset-0 rounded-full border border-red-500/20 animate-ping"></div>
                    </div>
                    
                    <div className="text-center space-y-1">
                        <span className="block text-[10px] font-black text-red-500 uppercase tracking-[0.4em] animate-pulse">Classified Record</span>
                        <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest font-mono">Authentication Failure // Access Restricted</span>
                    </div>
                    
                    {requiredLevel > 0 && (
                        <div className="mt-2 py-1 px-4 bg-red-600 text-white rounded-xs font-black tracking-[0.2em] text-[9px] border border-red-500 shadow-lg font-mono uppercase">
                            REQUIRES: {clearanceName}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RedactedReportCard;
