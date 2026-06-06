import { ServiceRequestStatus, UrgencyLevel, ThreatLevel, IntelThreatLevel } from '../../../../types';
import type { AccentKey } from '../../../shared/ui/accents';
import { formatUserDateTime, type FormatPrefs } from '../../../../lib/time';

export const statusAccent = (s: ServiceRequestStatus): AccentKey => {
    switch (s) {
        case ServiceRequestStatus.Submitted: return 'purple';
        case ServiceRequestStatus.Triaged: return 'amber';
        case ServiceRequestStatus.Accepted: return 'sky';
        case ServiceRequestStatus.InProgress: return 'cyan';
        case ServiceRequestStatus.Success: return 'emerald';
        case ServiceRequestStatus.Failed:
        case ServiceRequestStatus.Cancelled:
        case ServiceRequestStatus.Refused:
        case ServiceRequestStatus.Aborted:
        case ServiceRequestStatus.GameError:
            return 'red';
        default: return 'slate';
    }
};

export const statusLabel = (s: ServiceRequestStatus): string => {
    switch (s) {
        case ServiceRequestStatus.InProgress: return 'IN PROGRESS';
        case ServiceRequestStatus.GameError: return 'GAME ERROR';
        default: return s.toUpperCase();
    }
};

export const statusIcon = (s: ServiceRequestStatus): string => {
    switch (s) {
        case ServiceRequestStatus.Submitted: return 'fa-inbox';
        case ServiceRequestStatus.Triaged: return 'fa-clipboard-check';
        case ServiceRequestStatus.Accepted: return 'fa-circle-check';
        case ServiceRequestStatus.InProgress: return 'fa-bolt';
        case ServiceRequestStatus.Success: return 'fa-flag-checkered';
        case ServiceRequestStatus.Failed: return 'fa-circle-xmark';
        case ServiceRequestStatus.Cancelled: return 'fa-ban';
        case ServiceRequestStatus.Refused: return 'fa-hand';
        case ServiceRequestStatus.Aborted: return 'fa-stop-circle';
        case ServiceRequestStatus.GameError: return 'fa-triangle-exclamation';
        default: return 'fa-circle';
    }
};

export const urgencyAccent = (u: UrgencyLevel): AccentKey => {
    switch (u) {
        case UrgencyLevel.Critical: return 'red';
        case UrgencyLevel.High: return 'orange';
        case UrgencyLevel.Medium: return 'amber';
        case UrgencyLevel.Low: return 'sky';
        default: return 'slate';
    }
};

export const urgencyIcon = (u: UrgencyLevel): string => {
    switch (u) {
        case UrgencyLevel.Critical: return 'fa-bolt';
        case UrgencyLevel.High: return 'fa-triangle-exclamation';
        case UrgencyLevel.Medium: return 'fa-clock';
        case UrgencyLevel.Low: return 'fa-circle-dot';
        default: return 'fa-minus';
    }
};

export const threatAccent = (t: ThreatLevel | IntelThreatLevel): AccentKey => {
    switch (t) {
        case ThreatLevel.PVP:
        case ThreatLevel.Critical:
        case IntelThreatLevel.Critical:
            return 'red';
        case ThreatLevel.High:
        case IntelThreatLevel.High:
            return 'orange';
        case ThreatLevel.Medium:
        case IntelThreatLevel.Medium:
            return 'amber';
        case ThreatLevel.Low:
        case IntelThreatLevel.Low:
            return 'emerald';
        default: return 'slate';
    }
};

export const threatIcon = (t: ThreatLevel): string => {
    return t === ThreatLevel.PVP ? 'fa-crosshairs' : 'fa-skull-crossbones';
};

/** True when the threat level should pulse as a live alert. */
export const threatIsAlarm = (t: ThreatLevel | IntelThreatLevel): boolean => {
    return t === ThreatLevel.PVP
        || t === ThreatLevel.Critical
        || t === IntelThreatLevel.Critical
        || t === ThreatLevel.High
        || t === IntelThreatLevel.High;
};

export const reputationAccent = (rep: number): AccentKey => {
    if (rep >= 75) return 'emerald';
    if (rep >= 50) return 'sky';
    if (rep >= 25) return 'amber';
    return 'red';
};

export const timeAgo = (iso: string): string => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60_000);
    const hours = Math.round(diffMs / 3_600_000);
    const days = Math.round(diffMs / 86_400_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
};

export const timeAgoShort = (iso: string): string => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60_000);
    const hours = Math.round(diffMs / 3_600_000);
    const days = Math.round(diffMs / 86_400_000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
};

/**
 * Full request timestamp using the viewer's preferred preset + zone. Pass
 * `fmt.prefs` from `useFormatDate()` at the call site for per-user formatting.
 */
export const formatDateFull = (iso: string, prefs?: FormatPrefs): string => {
    return formatUserDateTime(iso, prefs);
};

// SLA derivation is client-only (no backend changes).
export const slaMinutes = (u: UrgencyLevel): number => {
    switch (u) {
        case UrgencyLevel.Critical: return 60;      // 1 hr
        case UrgencyLevel.High: return 240;         // 4 hr
        case UrgencyLevel.Medium: return 720;       // 12 hr
        case UrgencyLevel.Low: return 2880;         // 48 hr
        default: return 720;
    }
};

export const slaDeadline = (createdAt: string, u: UrgencyLevel): Date => {
    return new Date(new Date(createdAt).getTime() + slaMinutes(u) * 60_000);
};

export type SlaBucket = 'ok' | 'warning' | 'overdue';

export interface SlaState {
    remainingMs: number;
    totalMs: number;
    bucket: SlaBucket;
    /** Short formatted countdown — e.g. "43m", "2h 10m", "OVERDUE 12m". */
    label: string;
    accent: AccentKey;
}

const formatCountdown = (ms: number): string => {
    const absMs = Math.abs(ms);
    const mins = Math.floor(absMs / 60_000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
};

export const slaState = (createdAt: string, u: UrgencyLevel): SlaState => {
    const totalMs = slaMinutes(u) * 60_000;
    const deadline = slaDeadline(createdAt, u).getTime();
    const remainingMs = deadline - Date.now();
    let bucket: SlaBucket;
    let accent: AccentKey;
    if (remainingMs < 0) {
        bucket = 'overdue';
        accent = 'red';
    } else if (remainingMs < totalMs * 0.5) {
        bucket = 'warning';
        accent = 'amber';
    } else {
        bucket = 'ok';
        accent = 'emerald';
    }
    const label = remainingMs < 0
        ? `OVERDUE ${formatCountdown(remainingMs)}`
        : `SLA ${formatCountdown(remainingMs)}`;
    return { remainingMs, totalMs, bucket, label, accent };
};

/**
 * Statuses the user can advance *to* from the current status via one-click.
 * Limited to the common forward paths; full transitions go through the Update Status modal.
 */
export const nextValidStatuses = (current: ServiceRequestStatus): ServiceRequestStatus[] => {
    switch (current) {
        case ServiceRequestStatus.Submitted:
            return [ServiceRequestStatus.Triaged, ServiceRequestStatus.Accepted];
        case ServiceRequestStatus.Triaged:
            return [ServiceRequestStatus.Accepted];
        case ServiceRequestStatus.Accepted:
            return [ServiceRequestStatus.InProgress];
        case ServiceRequestStatus.InProgress:
            return [ServiceRequestStatus.Success, ServiceRequestStatus.Failed];
        default:
            return [];
    }
};
