import React from 'react';
import { ACCENTS, AccentKey } from '../../../shared/ui/accents';

export const SEARCH_ROW_HEIGHT = 88;

interface Props {
    accent: AccentKey;
    pulseRail?: boolean;
    onClick: () => void;
    isSelected?: boolean;
    /** FontAwesome icon class for the type tile (e.g. "fa-users"). */
    icon: string;
    /** Optional avatar replaces the icon tile. */
    avatarUrl?: string;
    children: React.ReactNode;
}

const SearchResultCard: React.FC<Props> = ({
    accent,
    pulseRail,
    onClick,
    isSelected,
    icon,
    avatarUrl,
    children,
}) => {
    const a = ACCENTS[accent];
    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            className={`group relative h-[${SEARCH_ROW_HEIGHT}px] flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl overflow-hidden border bg-linear-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 backdrop-blur-xs cursor-pointer transition-colors ${
                isSelected
                    ? 'border-sky-500/50 ring-1 ring-sky-500/30'
                    : 'border-white/10 hover:border-white/20'
            }`}
            style={{ height: SEARCH_ROW_HEIGHT }}
        >
            <div
                className={`absolute inset-y-0 left-0 w-1 ${a.dot} ${pulseRail ? 'animate-pulse' : ''}`}
                aria-hidden
            />

            <div
                className={`absolute -top-16 -left-8 w-44 h-44 ${a.bg} rounded-full blur-[80px] opacity-0 group-hover:opacity-50 pointer-events-none transition-opacity duration-300`}
                aria-hidden
            />

            {avatarUrl ? (
                <img
                    src={avatarUrl}
                    alt=""
                    className="relative w-10 h-10 rounded-full border-2 border-slate-700 group-hover:border-slate-500 shrink-0 object-cover transition-colors"
                />
            ) : (
                <div
                    className={`relative w-10 h-10 rounded-lg ${a.bg} border ${a.border} flex items-center justify-center shrink-0`}
                >
                    <i className={`fa-solid ${icon} ${a.text} text-base`} aria-hidden />
                </div>
            )}

            <div className="relative flex-1 min-w-0 flex flex-col justify-center gap-1">
                {children}
            </div>
        </div>
    );
};

export default SearchResultCard;
