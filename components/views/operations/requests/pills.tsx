import React from 'react';
import { ServiceRequestStatus, UrgencyLevel, ThreatLevel, IntelThreatLevel } from '../../../../types';
import { ACCENTS } from '../../../shared/ui/accents';
import {
    statusAccent, statusLabel, statusIcon,
    urgencyAccent, urgencyIcon,
    threatAccent, threatIcon, threatIsAlarm,
} from './requestStyles';

type Size = 'sm' | 'md';

const sizeClasses = (size: Size) => size === 'md'
    ? 'px-2.5 py-1 text-[11px]'
    : 'px-2 py-0.5 text-[10px]';

const baseClasses = 'inline-flex items-center gap-1.5 rounded-sm border font-black uppercase tracking-wider';

interface PillBaseProps {
    size?: Size;
    className?: string;
    pulse?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    title?: string;
}

function Pill({
    accentKey,
    icon,
    children,
    size = 'sm',
    className = '',
    pulse = false,
    onClick,
    title,
}: PillBaseProps & {
    accentKey: keyof typeof ACCENTS;
    icon?: string;
    children: React.ReactNode;
}) {
    const a = ACCENTS[accentKey];
    const Tag = onClick ? 'button' : 'span';
    return (
        <Tag
            title={title}
            onClick={onClick}
            className={`${baseClasses} ${sizeClasses(size)} ${a.bg} ${a.border} ${a.text} ${pulse ? 'animate-pulse' : ''} ${onClick ? 'hover:brightness-125 cursor-pointer transition' : ''} ${className}`}
        >
            {icon && <i className={`fa-solid ${icon}`} aria-hidden />}
            <span>{children}</span>
        </Tag>
    );
}

export const StatusPill: React.FC<{
    status: ServiceRequestStatus;
    size?: Size;
    showIcon?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
}> = ({ status, size = 'sm', showIcon = false, onClick, className = '' }) => (
    <Pill
        accentKey={statusAccent(status)}
        icon={showIcon ? statusIcon(status) : undefined}
        size={size}
        onClick={onClick}
        className={className}
    >
        {statusLabel(status)}
    </Pill>
);

export const UrgencyPill: React.FC<{
    urgency: UrgencyLevel;
    size?: Size;
    className?: string;
}> = ({ urgency, size = 'sm', className = '' }) => (
    <Pill
        accentKey={urgencyAccent(urgency)}
        icon={urgencyIcon(urgency)}
        size={size}
        pulse={urgency === UrgencyLevel.Critical}
        className={className}
    >
        {urgency}
    </Pill>
);

export const ThreatPill: React.FC<{
    threat: ThreatLevel;
    size?: Size;
    className?: string;
}> = ({ threat, size = 'sm', className = '' }) => {
    if (threat === ThreatLevel.None) return null;
    return (
        <Pill
            accentKey={threatAccent(threat)}
            icon={threatIcon(threat)}
            size={size}
            pulse={threatIsAlarm(threat)}
            className={className}
        >
            {threat}
        </Pill>
    );
};

export const IntelPill: React.FC<{
    level: IntelThreatLevel;
    size?: Size;
    className?: string;
}> = ({ level, size = 'sm', className = '' }) => {
    if (level === IntelThreatLevel.None) return null;
    return (
        <Pill
            accentKey={threatAccent(level)}
            icon="fa-eye"
            size={size}
            pulse={threatIsAlarm(level)}
            className={className}
        >
            Intel · {level}
        </Pill>
    );
};

// Used when an active warrant is matched for a client.
export const WarrantPill: React.FC<{ size?: Size; className?: string }> = ({ size = 'sm', className = '' }) => (
    <Pill
        accentKey="red"
        icon="fa-triangle-exclamation"
        size={size}
        pulse
        className={`shadow-[0_0_10px_rgba(220,38,38,0.3)] ${className}`}
    >
        Active Caution
    </Pill>
);
