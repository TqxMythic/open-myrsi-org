import { useCallback, useEffect, useRef, useState } from 'react';

interface Params {
    itemCount: number;
    onActivate: (index: number) => void;
    /** The element on which to attach the keydown listener. */
    listenerRef: React.RefObject<HTMLElement | null>;
    /** The scroll container for `scrollToIndex`. */
    scrollContainerRef: React.RefObject<HTMLElement | null>;
    /** Fixed row height matching VirtualizedList contract. */
    rowHeight: number;
}

export interface KeyboardNavApi {
    selectedIndex: number;
    setSelectedIndex: (i: number) => void;
    clear: () => void;
}

export const useSearchKeyboardNav = ({
    itemCount,
    onActivate,
    listenerRef,
    scrollContainerRef,
    rowHeight,
}: Params): KeyboardNavApi => {
    const [selectedIndex, setSelectedIndexState] = useState(-1);
    const itemCountRef = useRef(itemCount);
    itemCountRef.current = itemCount;

    // Reset out-of-range selection when results shrink.
    useEffect(() => {
        if (selectedIndex >= itemCount) setSelectedIndexState(-1);
    }, [itemCount, selectedIndex]);

    const scrollIntoView = useCallback((idx: number) => {
        const sc = scrollContainerRef.current;
        if (!sc) return;
        const rowTop = idx * rowHeight;
        const rowBottom = rowTop + rowHeight;
        const viewTop = sc.scrollTop;
        const viewBottom = viewTop + sc.clientHeight;
        if (rowTop < viewTop) {
            sc.scrollTo({ top: rowTop, behavior: 'smooth' });
        } else if (rowBottom > viewBottom) {
            sc.scrollTo({ top: rowBottom - sc.clientHeight, behavior: 'smooth' });
        }
    }, [scrollContainerRef, rowHeight]);

    const setSelectedIndex = useCallback((i: number) => {
        setSelectedIndexState(i);
        if (i >= 0) scrollIntoView(i);
    }, [scrollIntoView]);

    const clear = useCallback(() => setSelectedIndexState(-1), []);

    useEffect(() => {
        const el = listenerRef.current;
        if (!el) return;
        const handler = (e: KeyboardEvent) => {
            const total = itemCountRef.current;
            if (total === 0) return;
            // Don't hijack typing in inputs even if they bubble.
            const target = e.target as HTMLElement | null;
            const tag = target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndexState(prev => {
                    const next = prev < 0 ? 0 : Math.min(total - 1, prev + 1);
                    scrollIntoView(next);
                    return next;
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndexState(prev => {
                    const next = prev <= 0 ? 0 : prev - 1;
                    scrollIntoView(next);
                    return next;
                });
            } else if (e.key === 'Enter') {
                setSelectedIndexState(prev => {
                    if (prev >= 0 && prev < itemCountRef.current) {
                        e.preventDefault();
                        onActivate(prev);
                    }
                    return prev;
                });
            } else if (e.key === 'Escape') {
                setSelectedIndexState(prev => {
                    if (prev >= 0) {
                        e.preventDefault();
                        return -1;
                    }
                    return prev;
                });
            }
        };
        el.addEventListener('keydown', handler);
        return () => el.removeEventListener('keydown', handler);
    }, [listenerRef, onActivate, scrollIntoView]);

    return { selectedIndex, setSelectedIndex, clear };
};
