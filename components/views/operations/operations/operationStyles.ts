import { OperationStatus, OperationType } from '../../../../types';
import type { AccentKey } from '../../../shared/ui/accents';
import { getUserTimezoneLabel, formatUserDateTime, type FormatPrefs } from '../../../../lib/time';

export const operationStatusAccent = (s: OperationStatus): AccentKey => {
    switch (s) {
        case OperationStatus.Planning: return 'purple';
        case OperationStatus.Scheduled: return 'amber';
        case OperationStatus.Active: return 'emerald';
        case OperationStatus.Concluded: return 'slate';
        default: return 'slate';
    }
};

export const operationStatusIcon = (s: OperationStatus): string => {
    switch (s) {
        case OperationStatus.Planning: return 'fa-drafting-compass';
        case OperationStatus.Scheduled: return 'fa-clock';
        case OperationStatus.Active: return 'fa-bolt';
        case OperationStatus.Concluded: return 'fa-flag-checkered';
        default: return 'fa-circle';
    }
};

export const operationTypeAccent = (t: OperationType): AccentKey => {
    switch (t) {
        case OperationType.PvP: return 'red';
        case OperationType.PvE: return 'orange';
        case OperationType.Mixed: return 'purple';
        case OperationType.NonCombat: return 'sky';
        default: return 'sky';
    }
};

export const operationTypeIcon = (t: OperationType): string => {
    switch (t) {
        case OperationType.PvP: return 'fa-skull-crossbones';
        case OperationType.PvE: return 'fa-shield-halved';
        case OperationType.Mixed: return 'fa-arrows-split-up-and-left';
        case OperationType.NonCombat: return 'fa-handshake';
        default: return 'fa-circle-dot';
    }
};

export const clearanceAccent = (level: number): AccentKey => {
    switch (level) {
        case 1: return 'emerald';
        case 2: return 'sky';
        case 3: return 'amber';
        case 4: return 'orange';
        case 5: return 'red';
        default: return 'slate';
    }
};

/**
 * Scheduled-op timestamp with zone label appended ("01 Apr 26 10:00 AM GMT").
 * Pass `fmt.prefs` from `useFormatDate()` so the viewer's timezone + preset are honoured;
 * the zone is always appended to keep cross-timezone coordination unambiguous.
 */
export const formatScheduledTime = (iso: string, prefs?: FormatPrefs): string => {
    const formatted = formatUserDateTime(iso, prefs);
    if (formatted === '—') return '';
    const zone = getUserTimezoneLabel(prefs);
    return zone ? `${formatted} ${zone}` : formatted;
};

export const timeAgoShort = (iso: string): string => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60_000);
    const hours = Math.round(diffMs / 3_600_000);
    const days = Math.round(diffMs / 86_400_000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
};

export interface OperationCountdown {
    /** Formatted label (e.g. "2h 10m", "3d 4h", "OVERDUE 12m"). */
    label: string;
    /** Accent tuned to urgency — emerald far out, amber <12h, red overdue. */
    accent: AccentKey;
    isOverdue: boolean;
}

const formatCountdown = (ms: number): string => {
    const abs = Math.abs(ms);
    const mins = Math.floor(abs / 60_000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remM = mins % 60;
    if (hours < 24) return remM > 0 ? `${hours}h ${remM}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
};

/** Live-evaluated countdown toward a scheduled start. */
export const operationCountdown = (iso: string): OperationCountdown => {
    const remainingMs = new Date(iso).getTime() - Date.now();
    if (remainingMs < 0) {
        return { label: `OVERDUE ${formatCountdown(remainingMs)}`, accent: 'red', isOverdue: true };
    }
    const hours = remainingMs / 3_600_000;
    const accent: AccentKey = hours < 12 ? 'amber' : 'emerald';
    return { label: `T-${formatCountdown(remainingMs)}`, accent, isOverdue: false };
};
