// Create-listing + listing-detail (propose) modals for the marketplace.
import React, { useEffect, useMemo, useState } from 'react';
import apiService from '../../../services/apiService';
import type { MarketplaceCategory, MarketplaceListing, MarketplaceListingType } from '../../../types';
import { LISTING_TYPE_META, fmtUec } from './marketplaceMeta';
import WindowFrame from '../../layout/WindowFrame';

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
    <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
        {children}
        {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
    </div>
);

const inputCls = 'w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white text-sm outline-hidden focus:border-indigo-500';

interface WhStockOption { id: number; label: string }

const REPORT_REASONS: { value: string; label: string }[] = [
    { value: 'prohibited', label: 'Prohibited / banned goods' },
    { value: 'scam', label: 'Scam or fraud' },
    { value: 'spam', label: 'Spam or duplicate' },
    { value: 'misleading', label: 'Misleading description or price' },
    { value: 'harassment', label: 'Harassment or abuse' },
    { value: 'other', label: 'Other' },
];

// Confidential flag to moderators. Reused by the listing + contract detail modals;
// the caller wires onSubmit to the marketplace:report action with the right target.
export const ReportModal: React.FC<{
    targetLabel: string;
    onClose: () => void;
    onSubmit: (reasonCategory: string, details: string) => Promise<void>;
}> = ({ targetLabel, onClose, onSubmit }) => {
    const [reason, setReason] = useState('prohibited');
    const [details, setDetails] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async () => { setBusy(true); await onSubmit(reason, details.trim()).finally(() => setBusy(false)); };
    return (
        <WindowFrame isOpen onClose={onClose} title="Report" subtitle={targetLabel} icon="fa-solid fa-flag" color="red" width="max-w-md">
            <div className="p-5 space-y-4">
                <p className="text-xs text-slate-400">Flag this for a moderator to review. Reports are confidential — the other party isn't notified you reported.</p>
                <Field label="Reason">
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
                        {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </Field>
                <Field label="Details (optional)">
                    <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} className={`${inputCls} min-h-[90px]`} placeholder="What's wrong with this?" />
                </Field>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700/60">
                <button onClick={onClose} className="text-xs font-bold uppercase px-4 py-2 rounded-md text-slate-300 hover:text-white">Cancel</button>
                <button onClick={submit} disabled={busy} className="text-xs font-bold uppercase px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50">
                    {busy ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-flag mr-2"></i>Submit Report</>}
                </button>
            </div>
        </WindowFrame>
    );
};

export const CreateListingModal: React.FC<{
    categories: MarketplaceCategory[];
    onClose: () => void;
    onCreate: (input: Record<string, unknown>) => Promise<void>;
}> = ({ categories, onClose, onCreate }) => {
    const [listingType, setListingType] = useState<MarketplaceListingType>('sell');
    const kind: 'item' | 'service' = listingType === 'sell' || listingType === 'buy' ? 'item' : 'service';
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState<number | ''>('');
    const [quantity, setQuantity] = useState('1');
    const [priceUec, setPriceUec] = useState('');
    const [priceType, setPriceType] = useState('fixed');
    const [location, setLocation] = useState('');
    const [warehouseStockId, setWarehouseStockId] = useState<number | ''>('');
    const [whStock, setWhStock] = useState<WhStockOption[]>([]);
    const [busy, setBusy] = useState(false);

    // Best-effort warehouse stock list for the optional link (empty if no perm).
    useEffect(() => {
        let alive = true;
        apiService.getStateSubset('warehouse_stock').then((d) => {
            if (!alive) return;
            const rows = (d?.warehouseStock || []) as { id: number; catalog?: { name?: string }; quantityOnHand?: number }[];
            setWhStock(rows.map((r) => ({ id: r.id, label: `${r.catalog?.name || `Stock #${r.id}`} (${r.quantityOnHand ?? 0} on hand)` })));
        }).catch(() => undefined);
        return () => { alive = false; };
    }, []);

    const catOptions = useMemo(() => categories.filter((c) => c.listingKind === 'both' || c.listingKind === kind), [categories, kind]);

    const submit = async () => {
        if (!title.trim()) return;
        setBusy(true);
        await onCreate({
            kind, listingType, categoryId: categoryId || null, title: title.trim(),
            description: description.trim() || undefined,
            quantity: kind === 'item' ? Number(quantity) : null,
            priceUec: priceUec ? Number(priceUec) : null, priceType,
            location: location.trim() || undefined,
            warehouseStockId: kind === 'item' && warehouseStockId ? Number(warehouseStockId) : null,
        }).finally(() => setBusy(false));
    };

    return (
        <WindowFrame isOpen onClose={onClose} title="New Listing" subtitle="Marketplace" icon="fa-solid fa-plus" color="indigo" width="max-w-lg">
            <div className="p-5 space-y-4">
                <Field label="Listing Type">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(['sell', 'buy', 'offer', 'request'] as MarketplaceListingType[]).map((t) => {
                            const m = LISTING_TYPE_META[t];
                            return (
                                <button key={t} onClick={() => setListingType(t)}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-md border text-[11px] font-bold transition-colors ${listingType === t ? m.chip : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-white'}`}>
                                    <i className={`fa-solid ${m.icon}`} aria-hidden />{m.label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">{kind === 'item' ? 'An item trade — quantity applies.' : 'A service — no quantity; add milestones when a contract is proposed.'}</p>
                </Field>
                <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className={inputCls} placeholder={kind === 'item' ? 'e.g. Idris-P power plant' : 'e.g. Cargo hauling, any system'} /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Category">
                        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')} className={inputCls}>
                            <option value="">Uncategorised</option>
                            {catOptions.map((c) => <option key={c.id} value={c.id}>{c.parentId ? '— ' : ''}{c.name}</option>)}
                        </select>
                    </Field>
                    {kind === 'item' && <Field label="Quantity"><input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} /></Field>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Price (aUEC)"><input type="number" min={0} value={priceUec} onChange={(e) => setPriceUec(e.target.value)} className={inputCls} placeholder="Leave blank = negotiable" /></Field>
                    <Field label="Pricing">
                        <select value={priceType} onChange={(e) => setPriceType(e.target.value)} className={inputCls}>
                            <option value="fixed">Fixed</option>
                            <option value="negotiable">Negotiable</option>
                            {kind === 'item' ? <option value="per_unit">Per unit</option> : <option value="hourly">Per hour</option>}
                        </select>
                    </Field>
                </div>
                <Field label="Location (optional)"><input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={160} className={inputCls} placeholder="e.g. Port Olisar / Area18" /></Field>
                {kind === 'item' && whStock.length > 0 && (
                    <Field label="Link Warehouse Stock (optional)" hint="Reserves and moves real stock when the contract is accepted & delivered.">
                        <select value={warehouseStockId} onChange={(e) => setWarehouseStockId(e.target.value ? Number(e.target.value) : '')} className={inputCls}>
                            <option value="">No warehouse link</option>
                            {whStock.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </Field>
                )}
                <Field label="Description (optional)"><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} className={`${inputCls} min-h-[80px]`} /></Field>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700/60">
                <button onClick={onClose} className="text-xs font-bold uppercase px-4 py-2 rounded-md text-slate-300 hover:text-white">Cancel</button>
                <button onClick={submit} disabled={busy || !title.trim()} className="text-xs font-bold uppercase px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50">
                    {busy ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Post Listing'}
                </button>
            </div>
        </WindowFrame>
    );
};

export const ListingDetailModal: React.FC<{
    listing: MarketplaceListing; meId: number; canContract: boolean;
    onClose: () => void;
    onPropose: (payload: Record<string, unknown>) => Promise<void>;
    onDelete: () => Promise<void>;
    onReport: (payload: { reasonCategory: string; details?: string }) => Promise<void>;
}> = ({ listing, meId, canContract, onClose, onPropose, onDelete, onReport }) => {
    const isOwner = listing.sellerId === meId;
    const isItem = listing.kind === 'item';
    const remaining = listing.quantity != null ? Math.max(0, listing.quantity - listing.quantityClaimed) : null;
    const [showReport, setShowReport] = useState(false);
    const [qty, setQty] = useState('1');
    const [offer, setOffer] = useState(listing.priceUec != null ? String(listing.priceUec) : '');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const meta = LISTING_TYPE_META[listing.listingType];

    const propose = async () => {
        setBusy(true);
        await onPropose({
            listingId: listing.id,
            quantity: isItem ? Number(qty) : null,
            agreedPriceUec: offer ? Number(offer) : null,
            termsNote: note.trim() || undefined,
        }).finally(() => setBusy(false));
    };

    return (
        <>
        <WindowFrame isOpen onClose={onClose} title={listing.title} subtitle="Marketplace" icon={`fa-solid ${meta.icon}`} color="indigo" width="max-w-2xl">
            <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm border ${meta.chip}`}><i className={`fa-solid ${meta.icon} mr-1`} aria-hidden />{meta.label}</span>
                    {listing.categoryName && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border bg-slate-700/30 text-slate-300 border-slate-600/40">{listing.categoryName}</span>}
                    <span className="ml-auto text-lg font-black text-lime-400 font-mono">{listing.priceUec != null ? fmtUec(listing.priceUec) : 'Negotiable'}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5">{listing.seller?.avatarUrl && <img src={listing.seller.avatarUrl} alt="" className="w-5 h-5 rounded-full" />}{listing.seller?.name || `User #${listing.sellerId}`}</span>
                    {isItem && remaining != null && <span><i className="fa-solid fa-layer-group mr-1 text-slate-500" aria-hidden />{remaining} of {listing.quantity} available</span>}
                    {listing.location && <span><i className="fa-solid fa-location-dot mr-1 text-slate-500" aria-hidden />{listing.location}</span>}
                    {listing.warehouseStockId && <span className="text-cyan-400"><i className="fa-solid fa-boxes-stacked mr-1" aria-hidden />Warehouse-linked</span>}
                </div>
                {listing.description && <p className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-950/30 border border-slate-800/50 rounded-lg p-3">{listing.description}</p>}

                {!isOwner && canContract && (
                    <div className="border-t border-slate-700/50 pt-4 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">Propose a Contract</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {isItem && (
                                <Field label="Quantity"><input type="number" min={1} max={remaining ?? undefined} value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} /></Field>
                            )}
                            <Field label="Your Offer (aUEC)"><input type="number" min={0} value={offer} onChange={(e) => setOffer(e.target.value)} className={inputCls} placeholder="Optional" /></Field>
                        </div>
                        <Field label="Note to counterparty (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={250} className={inputCls} placeholder="Terms, timing, handoff details…" /></Field>
                        <button onClick={propose} disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-md disabled:opacity-50">
                            {busy ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-handshake mr-2"></i>Propose Contract</>}
                        </button>
                    </div>
                )}
                {isOwner && <p className="text-[11px] text-slate-500 italic border-t border-slate-700/50 pt-3">This is your listing. Manage incoming contracts from the My Contracts queue.</p>}
            </div>
            <div className="flex justify-end px-5 py-4 border-t border-slate-700/60">
                {isOwner ? (
                    <button onClick={onDelete} className="text-xs font-bold uppercase px-4 py-2 rounded-md bg-red-600/80 hover:bg-red-500 text-white">
                        <i className="fa-solid fa-trash mr-2"></i>Remove Listing
                    </button>
                ) : (
                    <button onClick={() => setShowReport(true)} className="text-xs font-bold uppercase px-4 py-2 rounded-md text-slate-400 hover:text-red-300 border border-slate-700/60 hover:border-red-500/40 transition-colors">
                        <i className="fa-solid fa-flag mr-2"></i>Report
                    </button>
                )}
            </div>
        </WindowFrame>
        {showReport && (
            <ReportModal targetLabel={listing.title} onClose={() => setShowReport(false)}
                onSubmit={async (reasonCategory, details) => { await onReport({ reasonCategory, details: details || undefined }); setShowReport(false); }} />
        )}
        </>
    );
};
