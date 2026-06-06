import React, { useMemo, useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import type { LedgerEntry, TreasuryAccount, LedgerEntryType, LedgerEntryStatus } from '../../../types';
import LedgerRow from './LedgerRow';
import ReverseEntryModal from './ReverseEntryModal';
import { useNotification } from '../../../contexts/NotificationContext';

interface Props {
    accounts: TreasuryAccount[];
    selectedAccountId: number | null;
    onSelectAccount: (id: number | null) => void;
    entries: LedgerEntry[];
    canManage: boolean;
    onRefresh: () => void;
}

const TYPE_FILTERS: readonly { value: 'all' | LedgerEntryType; label: string }[] = [
    { value: 'all', label: 'All types' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'withdrawal', label: 'Withdrawals' },
    { value: 'transfer', label: 'Transfers' },
    { value: 'payout', label: 'Payouts' },
    { value: 'adjustment', label: 'Adjustments' },
];

const STATUS_FILTERS: readonly { value: 'all' | LedgerEntryStatus; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'reversed', label: 'Reversed' },
];

export default function FinancesLedgerTab({
    accounts, selectedAccountId, onSelectAccount, entries, canManage, onRefresh,
}: Props) {
    const { rpcAction } = useData();
    const { addToast } = useNotification();

    const [typeFilter, setTypeFilter] = useState<'all' | LedgerEntryType>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | LedgerEntryStatus>('all');
    const [reverseTarget, setReverseTarget] = useState<LedgerEntry | null>(null);

    const filtered = useMemo(() => entries.filter((e) => {
        if (selectedAccountId && e.accountId !== selectedAccountId) return false;
        if (typeFilter !== 'all' && e.entryType !== typeFilter) return false;
        if (statusFilter !== 'all' && e.status !== statusFilter) return false;
        return true;
    }), [entries, selectedAccountId, typeFilter, statusFilter]);

    const handleExport = async () => {
        try {
            const res = await rpcAction('finance:export_csv', {
                accountId: selectedAccountId || undefined,
                entryType: typeFilter === 'all' ? undefined : typeFilter,
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: 5000,
            });
            const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = res.filename || 'ledger.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            addToast('Export ready', <i className="fa-solid fa-check" />, 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50');
        } catch (err: any) {
            addToast('Export failed', <i className="fa-solid fa-xmark" />, 'bg-red-500/10 text-red-400 border-red-500/50', {
                description: err?.message || 'Could not generate CSV.',
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-900 rounded-lg border border-white/10 p-1">
                    <button
                        onClick={() => onSelectAccount(null)}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition ${
                            selectedAccountId === null ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        All accounts
                    </button>
                    {accounts.filter((a) => a.isActive).map((a) => (
                        <button
                            key={a.id}
                            onClick={() => onSelectAccount(a.id)}
                            className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition ${
                                selectedAccountId === a.id ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {a.name}
                        </button>
                    ))}
                </div>

                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-300"
                >
                    {TYPE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-300"
                >
                    {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>

                <div className="flex-1" />
                <button
                    onClick={handleExport}
                    className="inline-flex items-center gap-2 bg-slate-900 border border-white/10 hover:border-amber-500/40 text-slate-300 hover:text-amber-200 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition"
                >
                    <i className="fa-solid fa-file-csv" /> Export CSV
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-slate-900/30 p-10 text-center text-slate-500 text-sm">
                    No entries match the current filters.
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((e) => (
                        <LedgerRow
                            key={e.id}
                            entry={e}
                            accounts={accounts}
                            onReverse={canManage && e.status === 'confirmed' ? () => setReverseTarget(e) : undefined}
                        />
                    ))}
                </div>
            )}

            {reverseTarget && (
                <ReverseEntryModal
                    entry={reverseTarget}
                    onClose={() => setReverseTarget(null)}
                    onSubmitted={() => { setReverseTarget(null); onRefresh(); }}
                />
            )}
        </div>
    );
}
