import { IntelThreatLevel, IntelSubjectType } from '../../../types';
import type { AccentKey } from '../../shared/ui/accents';
import { formatUserDateTime, type FormatPrefs } from '../../../lib/time';

export const threatAccent = (level: IntelThreatLevel | string | null | undefined): AccentKey => {
    switch (level) {
        case IntelThreatLevel.Critical: return 'red';
        case IntelThreatLevel.High: return 'orange';
        case IntelThreatLevel.Medium: return 'amber';
        case IntelThreatLevel.Low: return 'emerald';
        default: return 'slate';
    }
};

export const threatIcon = (level: IntelThreatLevel | string | null | undefined): string => {
    switch (level) {
        case IntelThreatLevel.Critical: return 'fa-triangle-exclamation';
        case IntelThreatLevel.High: return 'fa-circle-exclamation';
        case IntelThreatLevel.Medium: return 'fa-shield-halved';
        case IntelThreatLevel.Low: return 'fa-circle-info';
        default: return 'fa-circle-minus';
    }
};

export const threatLabel = (level: IntelThreatLevel | string | null | undefined): string => {
    const v = typeof level === 'string' ? level : IntelThreatLevel.None;
    return v.toUpperCase();
};

/** True when the threat level should pulse as a live alert. */
export const threatIsAlarm = (level: IntelThreatLevel | string | null | undefined): boolean =>
    level === IntelThreatLevel.Critical || level === IntelThreatLevel.High;

export const subjectIcon = (t: IntelSubjectType | string | null | undefined): string =>
    t === IntelSubjectType.Organization ? 'fa-building' : 'fa-user';

export const subjectLabel = (t: IntelSubjectType | string | null | undefined): string =>
    t === IntelSubjectType.Organization ? 'Organization' : 'Individual';

export const timeAgoShort = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60_000);
    const hours = Math.round(diffMs / 3_600_000);
    const days = Math.round(diffMs / 86_400_000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 30) return `${days}d`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo`;
    return `${Math.round(days / 365)}y`;
};

/**
 * Renders a stored ISO timestamp using the viewer's preferred format + zone.
 * Pass `fmt.prefs` from `useFormatDate()` for per-viewer formatting; omit it to
 * fall back to the browser zone + the `compact_12h` default preset.
 */
export const formatDateCompact = (iso: string | null | undefined, prefs?: FormatPrefs): string => {
    if (!iso) return 'N/A';
    return formatUserDateTime(iso, prefs);
};

export interface HumanisedAiError {
    title: string;
    body: string;
    kind: 'quota' | 'error';
}

/**
 * Strip internal prefixes ("QUOTA_EXCEEDED:", "Error:", "System Error:") and
 * return a title + body suitable for direct UI rendering.
 */
export const humaniseAiError = (raw: string): HumanisedAiError => {
    if (!raw) return { title: 'Unknown error', body: '', kind: 'error' };

    if (raw.startsWith('QUOTA_EXCEEDED:')) {
        return {
            title: 'Rate Limit Active',
            body: raw.replace(/^QUOTA_EXCEEDED:\s*/, '').trim() || 'The AI service is temporarily at capacity. Try again shortly.',
            kind: 'quota',
        };
    }

    const stripped = raw.replace(/^(Error:|System Error:)\s*/, '').trim();
    return {
        title: 'Analysis Failed',
        body: stripped || 'The AI service encountered an unexpected error.',
        kind: 'error',
    };
};
