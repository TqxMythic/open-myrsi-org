import React, { useState, useMemo } from 'react';
import { HydratedOperation, LogisticsCategory } from '../../../../types';
import { useAuth } from '../../../../contexts/AuthContext';
import { useData } from '../../../../contexts/DataContext';

interface OpLogisticsTabProps {
    operation: HydratedOperation;
    canManage: boolean;
    isParticipant: boolean;
    onRefresh: () => void;
}

const categoryIcons: Record<string, string> = {
    ammo: 'fa-solid fa-burst',
    medical: 'fa-solid fa-kit-medical',
    transport: 'fa-solid fa-truck',
    fuel: 'fa-solid fa-gas-pump',
    general: 'fa-solid fa-box',
};

const categoryColors: Record<string, string> = {
    ammo: 'text-red-400',
    medical: 'text-green-400',
    transport: 'text-sky-400',
    fuel: 'text-amber-400',
    general: 'text-slate-400',
};

const OpLogisticsTab: React.FC<OpLogisticsTabProps> = ({ operation, canManage, isParticipant, onRefresh }) => {
    const { currentUser } = useAuth();
    const { rpcAction } = useData();
    const items = useMemo(() => operation.logistics || [], [operation.logistics]);

    const [showForm, setShowForm] = useState(false);
    const [itemName, setItemName] = useState('');
    const [quantityNeeded, setQuantityNeeded] = useState('1');
    const [category, setCategory] = useState<LogisticsCategory>(LogisticsCategory.General);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const grouped = useMemo(() => {
        const groups: Record<string, typeof items> = {};
        Object.values(LogisticsCategory).forEach(c => { groups[c] = []; });
        items.forEach(item => {
            if (groups[item.category]) groups[item.category].push(item);
            else groups[LogisticsCategory.General].push(item);
        });
        return groups;
    }, [items]);

    const overallProgress = useMemo(() => {
        if (items.length === 0) return 0;
        const totalNeeded = items.reduce((acc, i) => acc + i.quantityNeeded, 0);
        const totalFulfilled = items.reduce((acc, i) => acc + i.quantityFulfilled, 0);
        return totalNeeded > 0 ? Math.round((totalFulfilled / totalNeeded) * 100) : 0;
    }, [items]);

    const handleAdd = async () => {
        if (!itemName.trim()) return;
        setSaving(true);
        try {
            await rpcAction('operation:add_logistics', {
                operationId: operation.id,
                data: { itemName: itemName.trim(), quantityNeeded: parseInt(quantityNeeded) || 1, category, notes: notes.trim() || undefined },
            });
            setItemName(''); setQuantityNeeded('1'); setCategory(LogisticsCategory.General); setNotes('');
            setShowForm(false);
            onRefresh();
        } finally {
            setSaving(false);
        }
    };

    const handleFulfill = async (itemId: number, qty: number) => {
        await rpcAction('operation:fulfill_logistics', {
            itemId, quantity: qty, operationId: operation.id,
        });
        onRefresh();
    };

    const handleDelete = async (itemId: number) => {
        await rpcAction('operation:delete_logistics', { itemId, operationId: operation.id });
        onRefresh();
    };

    const inputClass = "w-full bg-black/20 border border-slate-700/50 text-white text-sm rounded-lg px-3 py-2.5 outline-hidden focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/30 transition-all";
    const labelClass = "text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5 block";

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-boxes-stacked text-slate-500"></i> Logistics
                </h3>
                {canManage && (
                    <button onClick={() => setShowForm(!showForm)} className="text-[10px] font-bold text-purple-300 hover:text-purple-200 uppercase">
                        <i className="fa-solid fa-plus mr-1"></i> Add Item
                    </button>
                )}
            </div>

            {items.length > 0 && (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Overall Fulfillment</span>
                        <span className="text-sm font-bold text-white">{overallProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${overallProgress >= 100 ? 'bg-green-500' : overallProgress >= 50 ? 'bg-purple-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(overallProgress, 100)}%` }}></div>
                    </div>
                    <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
                        <span>{items.filter(i => i.status === 'Fulfilled').length} fulfilled</span>
                        <span>{items.filter(i => i.status === 'Partial').length} partial</span>
                        <span>{items.filter(i => i.status === 'Needed').length} needed</span>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 space-y-3 animate-fade-in">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className={labelClass}>Item Name</label>
                            <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g., Medpens" className={`${inputClass} w-full`} />
                        </div>
                        <div>
                            <label className={labelClass}>Qty Needed</label>
                            <input type="number" value={quantityNeeded} onChange={e => setQuantityNeeded(e.target.value)} min="1" className={`${inputClass} w-full`} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Category</label>
                            <select value={category} onChange={e => setCategory(e.target.value as LogisticsCategory)} className={`${inputClass} w-full`}>
                                {Object.values(LogisticsCategory).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Notes</label>
                            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" className={`${inputClass} w-full`} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowForm(false)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5">Cancel</button>
                        <button onClick={handleAdd} disabled={saving || !itemName.trim()} className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 px-4 py-1.5 rounded-sm disabled:opacity-50">
                            {saving ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Add Item'}
                        </button>
                    </div>
                </div>
            )}

            {Object.entries(grouped).map(([cat, catItems]) => {
                if (catItems.length === 0) return null;
                return (
                    <div key={cat}>
                        <h4 className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${categoryColors[cat] || 'text-slate-400'}`}>
                            <i className={categoryIcons[cat] || categoryIcons.general}></i>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            <span className="text-slate-600 text-[9px]">({catItems.length})</span>
                        </h4>
                        <div className="space-y-2">
                            {catItems.map(item => {
                                const pct = item.quantityNeeded > 0 ? Math.round((item.quantityFulfilled / item.quantityNeeded) * 100) : 0;
                                return (
                                    <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-lg border border-slate-700/30 group hover:bg-slate-800/60 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-white">{item.itemName}</span>
                                                <span className={`text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase ${
                                                    item.status === 'Fulfilled' ? 'text-green-400 bg-green-500/10 border-green-500/30' :
                                                    item.status === 'Partial' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                                                    'text-slate-400 bg-slate-500/10 border-slate-500/30'
                                                }`}>{item.status}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden max-w-[200px]">
                                                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-purple-500' : 'bg-amber-500'}`}
                                                        style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-400">{item.quantityFulfilled}/{item.quantityNeeded}</span>
                                            </div>
                                            {item.notes && <p className="text-[10px] text-slate-500 mt-1">{item.notes}</p>}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {(isParticipant || canManage) && item.status !== 'Fulfilled' && (
                                                <button onClick={() => handleFulfill(item.id, 1)}
                                                    className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 px-2 py-1 rounded-sm transition-colors">
                                                    <i className="fa-solid fa-plus mr-1"></i>1
                                                </button>
                                            )}
                                            {canManage && (
                                                <button onClick={() => handleDelete(item.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1">
                                                    <i className="fa-solid fa-xmark text-xs"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {items.length === 0 && !canManage && (
                <div className="flex flex-col items-center justify-center h-32 text-slate-600 opacity-50">
                    <i className="fa-solid fa-box-open text-3xl mb-2"></i>
                    <p className="text-xs italic">No logistics items tracked.</p>
                </div>
            )}
        </div>
    );
};

export default OpLogisticsTab;
