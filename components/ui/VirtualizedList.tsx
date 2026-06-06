
import React, { useState, useEffect, useRef } from 'react';

const OVERSCAN = 5;

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  itemHeight: number;
  scrollContainerId?: string;
  /** Fired when the visible window comes within `endReachedThreshold` items
   *  of the tail. Idempotent per items.length — re-fires only after more
   *  items arrive. Caller should still gate on its own loading flag. */
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export const VirtualizedList = <T extends { id: string | number }>({
  items,
  renderItem,
  itemHeight,
  scrollContainerId,
  onEndReached,
  endReachedThreshold = 5,
}: VirtualizedListProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleWindow, setVisibleWindow] = useState({ start: 0, end: 15 });
  const lastFiredAtLengthRef = useRef<number>(-1);

  useEffect(() => {
    let scrollContainer: HTMLElement | null = scrollContainerId ? document.getElementById(scrollContainerId) : null;

    // Auto-detect: walk up from our container to the nearest scrollable
    // ancestor. Views that wrap their content in `flex-1 overflow-y-auto`
    // inside an outer `overflow-hidden` shell would otherwise misuse the
    // outer `<main>` (which never scrolls), leaving the visible window
    // stuck at whatever was computed on first mount.
    if (!scrollContainer && containerRef.current) {
      let node: HTMLElement | null = containerRef.current.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight;
        if (isScrollable) { scrollContainer = node; break; }
        node = node.parentElement;
      }
    }

    // Fallback to <main> only if no scrollable ancestor was found.
    if (!scrollContainer) {
        scrollContainer = document.querySelector('main');
    }

    if (!scrollContainer) return;

    const handleScroll = () => {
      if (!containerRef.current || !scrollContainer) return;

      const { top: containerTop } = containerRef.current.getBoundingClientRect();
      const { top: scrollContainerTop, height: scrollContainerHeight } = scrollContainer.getBoundingClientRect();
      
      // How far the list's top has scrolled past the scroller's top: 0 when the
      // list sits at the top of the scroller, 100 once scrolled down 100px.
      const scrollTop = scrollContainerTop - containerTop;

      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - OVERSCAN);
      const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + scrollContainerHeight) / itemHeight) + OVERSCAN
      );

      setVisibleWindow(prev => {
        if (prev.start !== startIndex || prev.end !== endIndex) {
          return { start: startIndex, end: endIndex };
        }
        return prev;
      });

      if (onEndReached && items.length > 0) {
        const remaining = items.length - endIndex;
        if (remaining <= endReachedThreshold) {
          // Idempotent per items.length: only fire once per "list size", so a
          // single scroll tick can't issue dozens of duplicate calls. When the
          // caller appends a page, items.length changes and the next scroll
          // re-arms the trigger.
          if (lastFiredAtLengthRef.current !== items.length) {
            lastFiredAtLengthRef.current = items.length;
            onEndReached();
          }
        }
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [items.length, itemHeight, scrollContainerId, onEndReached, endReachedThreshold]);

  const totalHeight = items.length * itemHeight;
  const visibleItems = items.slice(visibleWindow.start, visibleWindow.end);
  const paddingTop = visibleWindow.start * itemHeight;

  return (
    <div ref={containerRef} style={{ position: 'relative', height: `${totalHeight}px` }}>
      <div style={{ paddingTop: `${paddingTop}px` }}>
        {visibleItems.map(item => (
          <div key={item.id} style={{ height: `${itemHeight}px` }}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
};
