import React, { useMemo, useState } from 'react';
import WindowFrame from '../../layout/WindowFrame';
import { useData } from '../../../contexts/DataContext';
import type { QmIssuance, QmUserRef } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';

type ReturnOutcome = 'returned_on_time' | 'returned_late' | 'returned_damaged';

interface Props {
    member: QmUserRef;
    /** Active issuances to offer for return (callers should pre-filter to status === 'active'). */
    issuances: QmIssuance[];
    onClose: () => void;
    onSubmitted: () => void;
}

interface Line {
    issuanceId: number;
    selected: boolean;
    returnedQty: string;
    outcome: ReturnOutcome;
}

const OUTCOMES: { key: ReturnOutcome; label: string }[] = [
    { key: 'returned_on_time', label: 'On time' },
    { key: 'returned_late', label: 'Late' },
    { key: 'returned_damaged', label: 'Damaged' },
];

export default function ReturnManyModal({ member, issuances, onClose, onSubmitted }: Props) {
    const { rpcAction } = useData();
    const { addToast } = useNotification();

    const [defaultOutcome, setDefaultOutcome] = useState<ReturnOutcome>('returned_on_time');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Initial state: all active issuances selected, full qty, outcome defaulted per-line.
    const [lines, setLines] = useState<Line[]>(() =>
        issuances.map(iss => ({
            issuanceId: iss.id,
            selected: true,
            returnedQty: String(iss.quantity),
            outcome: iss.isOverdue ? 'returned_late' : 'returned_on_time',
        })),
    );

    const byId = useMemo(() => {
        const m = new Map<number, QmIssuance>();
        for (const iss of issuances) m.set(iss.id, iss);
        return m;
    }, [issuances]);

    const selectedCount = lines.filter(l => l.selected).length;
    const valid = lines.some(l => {
        if (!l.selected) return false;
        const iss = byId.get(l.issuanceId);
        const qty = Math.trunc(Number(l.returnedQty));
        return !!iss && Number.isFinite(qty) && qty >= 0 && qty <= iss.quantity;
    });

    const setLine = (idx: number, patch: Partial<Line>) => {
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
    };
    const selectAll = (on: boolean) => setLines(prev => prev.map(l => ({ ...l, selected: on })));
    const applyOutcomeToSelected = (outcome: ReturnOutcome) => {
        setDefaultOutcome(outcome);
        setLines(prev => prev.map(l => l.selected ? { ...l, outcome } : l));
    };

    const submit = async () => {
        if (!valid || submitting) return;
        setSubmitting(true);

        const notesClean = notes.trim() || undefined;
        const toSubmit = lines.filter(l => l.selected);
        const payload = toSubmit.map(l => ({
            issuanceId: l.issuanceId,
            returnedQuantity: Math.trunc(Number(l.returnedQty)),
            outcome: l.outcome,
        }));

        try {
            const res = await rpcAction('qm:return_bulk', {
                lines: payload,
                notes: notesClean,
            });
            const closed = Number(res?.closed ?? payload.length);
            addToast(
                `Closed ${closed} ${closed === 1 ? 'issuance' : 'issuances'}`,
                <i className="fa-solid fa-check" />,
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/50',
            );
            onSubmitted();
        } catch (err: any) {
            addToast(
                'Return failed — no issuances closed',
                <i className="fa-solid fa-xmark" />,
                'bg-red-500/10 text-red-400 border-red-500/50',
                { description: err?.message || 'The batch was rolled back.' },
            );
            setSubmitting(false);
        }
    };

    const allSelected = lines.every(l => l.selected);
    const someSelected = lines.some(l => l.selected);

    return (
        <WindowFrame
            isOpen
            onClose={onClose}
            title={`Return from ${member.name}`}
            subtitle={`${issuances.length} active ${issuances.length === 1 ? 'issuance' : 'issuances'}`}
            icon="fa-solid fa-rotate-left"
            color="green"
            width="max-w-xl"
        >
            <div className="p-5 space-y-4">
                <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                        Default outcome <span className="text-slate-600">· applies to selected lines</span>
                    </span>
                    <div className="mt-1 flex gap-1 bg-slate-900 rounded-lg border border-white/10 p-1 w-fit">
                        {OUTCOMES.map(o => (
                            <button
                                key={o.key}
                                onClick={() => applyOutcomeToSelected(o.key)}
                                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition ${
                                    defaultOutcome === o.key ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => selectAll(e.target.checked)}
                            className="accent-emerald-500 w-4 h-4"
                        />
                        {allSelected ? 'Deselect all' : 'Select all'}
                    </label>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                        {selectedCount} / {lines.length} selected
                    </span>
                </div>

                <div className="space-y-1.5">
                    {lines.map((line, idx) => {
                        const iss = byId.get(line.issuanceId);
                        if (!iss) return null;
                        const name = iss.inventory?.catalog?.name || iss.inventory?.customName || `Item #${iss.inventoryId}`;
                        const qty = Math.trunc(Number(line.returnedQty));
                        const invalid = line.selected && (!Number.isFinite(qty) || qty < 0 || qty > iss.quantity);
                        const partial = line.selected && qty < iss.quantity;
                        return (
                            <div key={iss.id} className={`bg-slate-900/60 border rounded-lg px-3 py-2 transition ${
                                invalid ? 'border-rose-500/50'
                                : !line.selected ? 'border-white/5 opacity-60'
                                : 'border-white/10'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={line.selected}
                                        onChange={(e) => setLine(idx, { selected: e.target.checked })}
                                        className="accent-emerald-500 w-4 h-4 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white truncate font-bold">
                                            {iss.quantity}× {name}
                                            {iss.isOverdue && <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-rose-300">Overdue</span>}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono truncate">
                                            {iss.inventory?.catalog?.category || 'custom'}
                                            {iss.notes && ` · ${iss.notes}`}
                                        </div>
                                    </div>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        max={iss.quantity}
                                        disabled={!line.selected}
                                        value={line.returnedQty}
                                        onChange={(e) => setLine(idx, { returnedQty: e.target.value })}
                                        className={`w-14 bg-slate-950 border rounded px-2 py-1 text-sm font-mono text-right disabled:opacity-40 ${
                                            invalid ? 'border-rose-500/60 text-rose-200' : 'border-white/10 text-white'
                                        }`}
                                        aria-label="Returned quantity"
                                    />
                                    <select
                                        value={line.outcome}
                                        disabled={!line.selected}
                                        onChange={(e) => setLine(idx, { outcome: e.target.value as ReturnOutcome })}
                                        className="bg-slate-950 border border-white/10 rounded-sm px-2 py-1 text-[11px] text-slate-200 disabled:opacity-40"
                                    >
                                        {OUTCOMES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                                    </select>
                                </div>
                                {partial && (
                                    <div className="text-[10px] text-amber-400 font-mono mt-1 ml-6">
                                        Partial: {iss.quantity - qty} of {iss.quantity} not returned
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <label className="block">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Notes (optional)</span>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        maxLength={400}
                        placeholder="Applied to each returned line"
                        className="mt-1 w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    />
                </label>

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!someSelected || !valid || submitting}
                        className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {submitting
                            ? 'Closing…'
                            : selectedCount > 1 ? `Close ${selectedCount}` : 'Close Issuance'}
                    </button>
                </div>
            </div>
        </WindowFrame>
    );
}
