// Non-component marketplace UI constants/helpers (kept out of the .tsx component
// files so react-refresh fast-refresh stays happy).
import type { MarketplaceContractStatus, MarketplaceListingType } from '../../../types';

export const LISTING_TYPE_META: Record<MarketplaceListingType, { label: string; icon: string; stripe: string; chip: string }> = {
    sell: { label: 'Selling', icon: 'fa-tag', stripe: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
    buy: { label: 'Buying', icon: 'fa-cart-shopping', stripe: 'bg-sky-500', chip: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
    offer: { label: 'Offering', icon: 'fa-handshake-angle', stripe: 'bg-indigo-500', chip: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' },
    request: { label: 'Requesting', icon: 'fa-hand', stripe: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
};

export const CONTRACT_STATUS_META: Record<MarketplaceContractStatus, { label: string; cls: string; icon: string }> = {
    proposed: { label: 'Proposed', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30', icon: 'fa-paper-plane' },
    accepted: { label: 'Accepted', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30', icon: 'fa-check' },
    in_progress: { label: 'In Progress', cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', icon: 'fa-spinner' },
    delivered: { label: 'Delivered', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: 'fa-truck' },
    completed: { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: 'fa-circle-check' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-500/15 text-red-300 border-red-500/30', icon: 'fa-ban' },
};

export const fmtUec = (n: number | null | undefined): string =>
    n == null ? '—' : `${n.toLocaleString()} aUEC`;
