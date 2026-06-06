import React, { useState } from 'react';
import { HydratedOperation } from '../../../../types';
import { useOperations } from '../../../../contexts/OperationsContext';

interface OpMissionTabProps {
    operation: HydratedOperation;
    canManage: boolean;
    onRefresh: () => void;
}

const ROESection: React.FC<{ operation: HydratedOperation; canManage: boolean; onUpdate: (roe: string) => Promise<any> }> = ({ operation, canManage, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(operation.roe || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onUpdate(value);
            setIsEditing(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-amber-950/15 rounded-xl border border-amber-500/15 overflow-hidden">
            <div className="px-5 py-3 bg-amber-950/20 border-b border-amber-500/10 flex items-center justify-between">
                <p className="text-[10px] text-amber-400/80 uppercase font-black tracking-[0.15em] flex items-center gap-2">
                    <i className="fa-solid fa-shield-halved"></i> Rules of Engagement
                </p>
                {canManage && !isEditing && (
                    <button onClick={() => { setValue(operation.roe || ''); setIsEditing(true); }}
                        className="text-slate-500 hover:text-amber-400 transition-colors"><i className="fa-solid fa-pen-to-square text-xs"></i></button>
                )}
            </div>
            <div className="p-5">
                {isEditing ? (
                    <div className="space-y-3">
                        <textarea value={value} onChange={e => setValue(e.target.value)} rows={5}
                            className="w-full bg-black/20 border border-amber-500/20 rounded-lg p-3 text-amber-100 text-sm focus:border-amber-500/50 outline-hidden resize-none font-light leading-relaxed"
                            placeholder="Define rules of engagement..." />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setIsEditing(false)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                                {saving ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Save ROE'}
                            </button>
                        </div>
                    </div>
                ) : operation.roe ? (
                    <div className="text-amber-200/80 text-sm whitespace-pre-wrap font-light leading-relaxed">{operation.roe}</div>
                ) : (
                    <p className="text-amber-500/30 text-xs italic">No ROE defined.</p>
                )}
            </div>
        </div>
    );
};

const CommanderNotesSection: React.FC<{ operation: HydratedOperation; canManage: boolean; onUpdate: (notes: string) => Promise<any> }> = ({ operation, canManage, onUpdate }) => {
    const [isOpen, setIsOpen] = useState(!!operation.commanderNotes);
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(operation.commanderNotes || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onUpdate(value);
            setIsEditing(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-slate-900/60 rounded-xl border border-slate-700/30 overflow-hidden">
            <button onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-3 bg-slate-800/40 border-b border-slate-700/30 flex items-center justify-between hover:bg-slate-800/60 transition-colors">
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.15em] flex items-center gap-2">
                    <i className={`fa-solid fa-chevron-right text-[8px] transition-transform ${isOpen ? 'rotate-90' : ''}`}></i>
                    <i className="fa-solid fa-scroll text-slate-500/60"></i> Commander's Notes
                    {!isOpen && !operation.commanderNotes && <span className="text-slate-600 normal-case font-normal italic ml-2">(empty)</span>}
                </p>
                {canManage && isOpen && !isEditing && (
                    <span onClick={(e) => { e.stopPropagation(); setValue(operation.commanderNotes || ''); setIsEditing(true); }}
                        className="text-slate-500 hover:text-purple-400 transition-colors"><i className="fa-solid fa-pen-to-square text-xs"></i></span>
                )}
            </button>
            {isOpen && (
                <div className="p-5">
                    {isEditing ? (
                        <div className="space-y-3">
                            <textarea value={value} onChange={e => setValue(e.target.value)} rows={5}
                                className="w-full bg-black/20 border border-slate-700/50 rounded-lg p-3 text-white text-sm focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 outline-hidden resize-none font-light leading-relaxed"
                                placeholder="Add commander's notes..." />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setIsEditing(false)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">Cancel</button>
                                <button onClick={handleSave} disabled={saving} className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                                    {saving ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Save Notes'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-slate-300 text-sm whitespace-pre-wrap font-light leading-relaxed">
                            {operation.commanderNotes || <span className="text-slate-600 italic">No notes added yet.</span>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const OpMissionTab: React.FC<OpMissionTabProps> = ({ operation, canManage, onRefresh }) => {
    const { updateOperationDetails } = useOperations();

    return (
        <div className="p-6 lg:p-8 space-y-6">
            <div className="bg-slate-900/60 rounded-xl border border-slate-700/30 overflow-hidden">
                <div className="px-5 py-3 bg-slate-800/40 border-b border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.15em] flex items-center gap-2">
                        <i className="fa-solid fa-crosshairs text-purple-400/70"></i> Mission Briefing
                    </p>
                </div>
                <div className="p-6">
                    <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-light max-h-96 overflow-y-auto custom-scrollbar">
                        {operation.description || <span className="text-slate-600 italic">No briefing provided.</span>}
                    </div>
                </div>
            </div>

            {(operation.roe || canManage) && (
                <ROESection operation={operation} canManage={canManage} onUpdate={(roe) => updateOperationDetails(operation.id, { roe })} />
            )}

            {(operation.commanderNotes || canManage) && (
                <CommanderNotesSection operation={operation} canManage={canManage} onUpdate={(commanderNotes) => updateOperationDetails(operation.id, { commanderNotes })} />
            )}
        </div>
    );
};

export default OpMissionTab;
