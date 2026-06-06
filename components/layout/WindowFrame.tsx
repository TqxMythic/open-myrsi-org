import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type WindowColor = 'sky' | 'red' | 'amber' | 'green' | 'emerald' | 'indigo' | 'purple' | 'orange' | 'slate';

interface WindowFrameProps {
    title: string;
    subtitle?: string;
    icon: string;
    isOpen: boolean;
    onClose: () => void;
    onMinimize?: () => void;
    children: React.ReactNode;
    color?: WindowColor;
    width?: string; // Tailwind class e.g., 'max-w-2xl' (used for initial/max, overridden by resize)
    initialX?: number;
    initialY?: number;
}

const getColorStyles = (color: WindowColor) => {
    switch (color) {
        case 'red': return {
            border: 'border-red-500/30',
            headerBg: 'bg-red-950/30',
            iconBg: 'bg-red-500/20',
            text: 'text-red-400',
            glow: 'shadow-[0_0_30px_rgba(220,38,38,0.15)]'
        };
        case 'amber': return {
            border: 'border-amber-500/30',
            headerBg: 'bg-amber-950/30',
            iconBg: 'bg-amber-500/20',
            text: 'text-amber-400',
            glow: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]'
        };
        case 'green': return {
            border: 'border-green-500/30',
            headerBg: 'bg-green-950/30',
            iconBg: 'bg-green-500/20',
            text: 'text-green-400',
            glow: 'shadow-[0_0_30px_rgba(34,197,94,0.15)]'
        };
        case 'emerald': return {
            border: 'border-emerald-500/30',
            headerBg: 'bg-emerald-950/30',
            iconBg: 'bg-emerald-500/20',
            text: 'text-emerald-400',
            glow: 'shadow-[0_0_30px_rgba(16,185,129,0.15)]'
        };
        case 'indigo': return {
            border: 'border-indigo-500/30',
            headerBg: 'bg-indigo-950/30',
            iconBg: 'bg-indigo-500/20',
            text: 'text-indigo-400',
            glow: 'shadow-[0_0_30px_rgba(99,102,241,0.15)]'
        };
        case 'purple': return {
            border: 'border-purple-500/30',
            headerBg: 'bg-purple-950/30',
            iconBg: 'bg-purple-500/20',
            text: 'text-purple-400',
            glow: 'shadow-[0_0_30px_rgba(168,85,247,0.15)]'
        };
        case 'orange': return {
            border: 'border-orange-500/30',
            headerBg: 'bg-orange-950/30',
            iconBg: 'bg-orange-500/20',
            text: 'text-orange-400',
            glow: 'shadow-[0_0_30px_rgba(249,115,22,0.15)]'
        };
        case 'slate': return {
            border: 'border-slate-600/50',
            headerBg: 'bg-slate-800/50',
            iconBg: 'bg-slate-700/50',
            text: 'text-slate-300',
            glow: 'shadow-[0_0_30px_rgba(148,163,184,0.1)]'
        };
        case 'sky':
        default: return {
            border: 'border-sky-500/30',
            headerBg: 'bg-sky-950/30',
            iconBg: 'bg-sky-500/20',
            text: 'text-sky-400',
            glow: 'shadow-[0_0_30px_rgba(14,165,233,0.15)]'
        };
    }
};

const WindowFrame: React.FC<WindowFrameProps> = ({
    title,
    subtitle,
    icon,
    isOpen,
    onClose,
    onMinimize,
    children,
    color = 'sky',
    width = 'max-w-lg', // Used as a default hint if no explicit pixel width set by resize
    initialX,
    initialY
}) => {
    // Detect mobile state for conditional logic
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile(); // Initial check
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // State for position and movement tracking
    // hasMoved = true means user dragged/resized, so we use absolute pixels.
    // hasMoved = false means we use CSS centering.
    const [position, setPosition] = useState({ 
        x: initialX ?? 0, 
        y: initialY ?? 100 
    });
    const [hasMoved, setHasMoved] = useState(false);
    
    // Size state for resizing
    const [size, setSize] = useState<{ width: number | string, height: number | string }>({ width: '', height: '' });
    
    const windowRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number, startY: number, initialLeft: number, initialTop: number } | null>(null);
    const resizeRef = useRef<{ startX: number, startY: number, initialWidth: number, initialHeight: number } | null>(null);

    // Reset/Initialize position on open
    useEffect(() => {
        if (isOpen) {
             if (initialX !== undefined || initialY !== undefined) {
                 setPosition({ x: initialX || 0, y: initialY || 100 });
                 setHasMoved(true);
             } else {
                 // Reset to centered default when re-opening without props.
                 setHasMoved(false);
                 setPosition({ x: 0, y: 100 }); 
             }
        }
    }, [isOpen, initialX, initialY]);

    // Drag Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isMobile) return; // Disable drag on mobile
        if (e.target !== e.currentTarget) return; // Only header itself
        
        let startX = position.x;
        let startY = position.y;

        // If currently centered via CSS, capture actual pixel position to start drag
        if (!hasMoved && windowRef.current) {
            const rect = windowRef.current.getBoundingClientRect();
            startX = rect.left;
            startY = rect.top;
            setPosition({ x: startX, y: startY });
            setHasMoved(true);
        }

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialLeft: startX,
            initialTop: startY
        };
        
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            
            setPosition({
                x: dragRef.current.initialLeft + dx,
                y: dragRef.current.initialTop + dy
            });
        };

        const handleMouseUp = () => {
            dragRef.current = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Resize Logic
    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (!windowRef.current) return;

        // If currently centered via CSS, lock position before resizing
        if (!hasMoved) {
            const rect = windowRef.current.getBoundingClientRect();
            setPosition({ x: rect.left, y: rect.top });
            setHasMoved(true);
        }
        
        resizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialWidth: windowRef.current.offsetWidth,
            initialHeight: windowRef.current.offsetHeight
        };

        const handleResizeMouseMove = (e: MouseEvent) => {
            if (!resizeRef.current) return;
            const dx = e.clientX - resizeRef.current.startX;
            const dy = e.clientY - resizeRef.current.startY;
            
            // Min dimensions
            const newWidth = Math.max(300, resizeRef.current.initialWidth + dx);
            const newHeight = Math.max(200, resizeRef.current.initialHeight + dy);

            setSize({ width: newWidth, height: newHeight });
        };

        const handleResizeMouseUp = () => {
            resizeRef.current = null;
            document.removeEventListener('mousemove', handleResizeMouseMove);
            document.removeEventListener('mouseup', handleResizeMouseUp);
        };

        document.addEventListener('mousemove', handleResizeMouseMove);
        document.addEventListener('mouseup', handleResizeMouseUp);
    }

    // Ensure window stays within bounds on resize (basic check)
    // Only apply if manual positioning is active
    useEffect(() => {
        if (!isMobile && hasMoved) {
            if (position.x > window.innerWidth - 100) setPosition(p => ({ ...p, x: window.innerWidth - 320 }));
            if (position.y > window.innerHeight - 100) setPosition(p => ({ ...p, y: window.innerHeight - 200 }));
        }
    }, [isMobile, hasMoved, position.x, position.y]);

    if (!isOpen) return null;

    // Cast color to WindowColor since the prop arrives as a plain string.
    const styles = getColorStyles(color as WindowColor);

    // Apply inline styles only on desktop. Mobile uses CSS classes for full screen.
    const styleObj: React.CSSProperties = isMobile ? {
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column' as const,
    } : {
        left: hasMoved ? position.x : '50%',
        top: position.y,
        transform: hasMoved ? 'none' : 'translateX(-50%)',
        maxHeight: '90vh',
        width: size.width || undefined,
        height: size.height || undefined
    };

    // Mobile fills the screen; desktop (sm+) floats as a rounded card with
    // sm:h-auto so content dictates height instead of stretching full-screen.
    const containerClasses = `
        fixed flex flex-col 
        backdrop-blur-xl bg-slate-900/95 border shadow-2xl animate-fade-in z-100
        ${styles.border} ${styles.glow}
        
        inset-0 w-full h-full rounded-none
        
        sm:inset-auto sm:rounded-xl sm:min-w-[440px] sm:h-auto
        ${!isMobile && !size.width ? width : ''}
    `;

    return createPortal(
        <div 
            ref={windowRef}
            className={containerClasses}
            style={styleObj}
        >
            {/* Header / Drag Handle */}
            <div 
                className={`flex items-center justify-between p-4 select-none border-b border-white/5 ${styles.headerBg} ${isMobile ? '' : 'cursor-move'}`}
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-3 overflow-hidden pointer-events-none">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${styles.iconBg} ${styles.text} border border-white/5`}>
                        <i className={icon}></i>
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm tracking-wide truncate">{title}</h3>
                        {subtitle && <p className={`text-[10px] uppercase font-black tracking-wider truncate ${styles.text} opacity-80`}>{subtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-1 pl-4">
                    {onMinimize && !isMobile && (
                        <button
                            onClick={onMinimize}
                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-500 hover:text-amber-400 transition-colors"
                            title="Minimize"
                        >
                            <i className="fa-solid fa-window-minimize text-xs"></i>
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 relative min-h-0">
                {children}
            </div>

            {/* Resize Handle (Desktop Only) */}
            {!isMobile && (
                <div 
                    className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-20 flex items-end justify-end p-1 group"
                    onMouseDown={handleResizeMouseDown}
                >
                     <div className={`w-2 h-2 border-r-2 border-b-2 rounded-br ${styles.text} opacity-50 group-hover:opacity-100`}></div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default WindowFrame;