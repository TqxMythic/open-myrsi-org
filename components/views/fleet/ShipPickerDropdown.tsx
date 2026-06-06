
import React, { useState, useRef, useEffect } from 'react';
import { UserShip, ShipStatus } from '../../../types';

const getStatusColor = (status: ShipStatus) => {
    switch (status) {
        case ShipStatus.Active: return 'bg-green-500/10 text-green-400 border-green-500/30';
        case ShipStatus.Stored: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
        case ShipStatus.Damaged: return 'bg-red-500/10 text-red-400 border-red-500/30';
        case ShipStatus.Lent: return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        case ShipStatus.Sold: return 'bg-slate-700/50 text-slate-500 border-slate-600';
    }
};

export interface ShipPickerSelection {
    userShipId: number | null;
    shipId: number | null;
    shipName: string;
}

interface ShipPickerDropdownProps {
    ships: UserShip[];
    value?: number | null;
    onChange: (selection: ShipPickerSelection | null) => void;
    disabled?: boolean;
    label?: string;
}

const ShipPickerDropdown: React.FC<ShipPickerDropdownProps> = ({ ships, value, onChange, disabled, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = value ? ships.find(s => s.id === value) : null;

    const filtered = ships.filter(s => {
        if (!search.trim()) return true;
        const term = search.toLowerCase();
        const name = (s.customName || s.ship?.name || '').toLowerCase();
        const mfr = (s.ship?.manufacturer || '').toLowerCase();
        return name.includes(term) || mfr.includes(term);
    });

    const handleSelect = (us: UserShip | null) => {
        if (!us) {
            onChange(null);
        } else {
            onChange({
                userShipId: us.id,
                shipId: us.shipId,
                shipName: us.customName || us.ship?.name || 'Unknown Ship',
            });
        }
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div ref={ref} className="relative">
            {label && <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full bg-slate-900/60 border rounded-lg p-2.5 text-left text-sm flex items-center gap-2 transition-all disabled:opacity-50 ${isOpen ? 'border-orange-500/40 ring-1 ring-orange-500/50' : 'border-slate-700 hover:border-slate-600'}`}
            >
                {selected ? (
                    <>
                        {selected.ship?.imageUrl && (
                            <img src={selected.ship.imageUrl} alt="" className="w-8 h-5 object-cover rounded-sm shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <span className="text-white truncate flex-1">{selected.customName || selected.ship?.name}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${getStatusColor(selected.status)}`}>{selected.status}</span>
                    </>
                ) : (
                    <span className="text-slate-500 flex-1">Select ship…</span>
                )}
                <i className={`fa-solid fa-chevron-down text-[10px] text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-xl max-h-64 overflow-hidden flex flex-col">
                    {ships.length > 5 && (
                        <div className="p-2 border-b border-white/5">
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search ships…"
                                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-hidden focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/30 transition-all"
                                autoFocus
                            />
                        </div>
                    )}
                    <div className="overflow-y-auto custom-scrollbar">
                        <button
                            onClick={() => handleSelect(null)}
                            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 border-b border-white/5"
                        >
                            <i className="fa-solid fa-ban text-[10px]"></i> None / Clear
                        </button>

                        {filtered.length > 0 ? filtered.map(us => (
                            <button
                                key={us.id}
                                onClick={() => handleSelect(us)}
                                className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-2.5 ${value === us.id ? 'bg-orange-500/15 border-l-2 border-orange-400' : 'hover:bg-orange-500/10 border-l-2 border-transparent'}`}
                            >
                                {us.ship?.imageUrl ? (
                                    <img src={us.ship.imageUrl} alt="" className="w-10 h-7 object-cover rounded-sm shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                    <div className="w-10 h-7 rounded-sm bg-slate-800 flex items-center justify-center shrink-0">
                                        <i className="fa-solid fa-rocket text-slate-600 text-[10px]"></i>
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className={`text-xs font-bold truncate ${value === us.id ? 'text-orange-200' : 'text-white'}`}>{us.customName || us.ship?.name}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest truncate">{us.ship?.manufacturer}</p>
                                </div>
                                {value === us.id && <i className="fa-solid fa-check text-orange-300 text-[10px] shrink-0"></i>}
                                <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm border shrink-0 ${getStatusColor(us.status)}`}>
                                    {us.status}
                                </span>
                            </button>
                        )) : (
                            <div className="px-3 py-4 text-center text-slate-500 text-xs italic">
                                {search ? 'No ships match your search' : 'No ships in hangar'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShipPickerDropdown;
