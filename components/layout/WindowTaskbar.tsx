
import React from 'react';
import { createPortal } from 'react-dom';

import { useModalRegistry } from '../../contexts/ModalRegistryContext';

const colorMap: Record<string, { bg: string; border: string; text: string; hoverBg: string }> = {
    sky: { bg: 'bg-sky-950/60', border: 'border-sky-500/30', text: 'text-sky-400', hoverBg: 'hover:bg-sky-900/60' },
    red: { bg: 'bg-red-950/60', border: 'border-red-500/30', text: 'text-red-400', hoverBg: 'hover:bg-red-900/60' },
    amber: { bg: 'bg-amber-950/60', border: 'border-amber-500/30', text: 'text-amber-400', hoverBg: 'hover:bg-amber-900/60' },
    green: { bg: 'bg-green-950/60', border: 'border-green-500/30', text: 'text-green-400', hoverBg: 'hover:bg-green-900/60' },
    indigo: { bg: 'bg-indigo-950/60', border: 'border-indigo-500/30', text: 'text-indigo-400', hoverBg: 'hover:bg-indigo-900/60' },
    slate: { bg: 'bg-slate-800/60', border: 'border-slate-600/50', text: 'text-slate-300', hoverBg: 'hover:bg-slate-700/60' },
};

const WindowTaskbar: React.FC = () => {
    const { minimizedWindows, restoreWindow, closeMinimizedWindow } = useModalRegistry();

    if (minimizedWindows.length === 0) return null;

    const grouped = minimizedWindows.reduce((acc, win) => {
        const group = win.type.split('-')[0]; // 'intel', 'bulletin', etc.
        if (!acc[group]) acc[group] = [];
        acc[group].push(win);
        return acc;
    }, {} as Record<string, typeof minimizedWindows>);

    return createPortal(
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-90 animate-fade-in">
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl px-3 py-2 shadow-2xl shadow-black/40">
                {Object.entries(grouped).map(([group, windows]) => (
                    <div key={group} className="flex items-center gap-1">
                        {windows.length > 1 && (
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1 hidden sm:inline">
                                {group}
                            </span>
                        )}
                        {windows.map(win => {
                            const colors = colorMap[win.color] || colorMap.slate;
                            return (
                                <div key={win.id} className="flex items-center group">
                                    <button
                                        onClick={() => restoreWindow(win.id)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${colors.bg} ${colors.border} ${colors.hoverBg}`}
                                        title={`Restore: ${win.title}`}
                                    >
                                        <i className={`${win.icon} text-xs ${colors.text}`}></i>
                                        <span className="text-[10px] font-bold text-slate-300 max-w-[120px] truncate">
                                            {win.title}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => closeMinimizedWindow(win.id)}
                                        className="w-5 h-5 flex items-center justify-center rounded-full text-slate-600 hover:text-red-400 hover:bg-red-950/40 transition-all opacity-0 group-hover:opacity-100 -ml-1"
                                        title="Close"
                                    >
                                        <i className="fa-solid fa-xmark text-[8px]"></i>
                                    </button>
                                </div>
                            );
                        })}
                        {Object.keys(grouped).length > 1 && (
                            <div className="w-px h-5 bg-slate-700/50 mx-0.5 last:hidden"></div>
                        )}
                    </div>
                ))}
            </div>
        </div>,
        document.body
    );
};

export default WindowTaskbar;
