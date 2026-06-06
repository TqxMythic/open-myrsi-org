import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text as KonvaText, Group } from 'react-konva';
import type Konva from 'konva';
import { OperationBoardElement } from '../../../types';

// Static read-only render of a tactical board, used by the joint-operation mirror view.
// Mirrors the element styling of the editor (TacticalBoard in OpCommandSignalsTab.tsx) but
// carries none of its edit/realtime machinery — no RPC, no subscription, no drag/undo. Pan + zoom only.

const ELEMENT_COLORS: Record<string, string> = {
    unit: '#3b82f6', waypoint: '#f59e0b', ship: '#06b6d4', zone: '#22c55e',
    line: '#94a3b8', text: '#e2e8f0', icon: '#a855f7',
};
// Unicode symbols (FontAwesome isn't available inside the canvas).
const ELEMENT_SYMBOLS: Record<string, string> = {
    unit: '⚔', waypoint: '◉', ship: '✈', zone: '□', line: '─', text: 'T', icon: '★',
};

interface Props {
    boardElements: OperationBoardElement[];
    height?: number;
}

const TacticalBoardViewer: React.FC<Props> = ({ boardElements, height = 420 }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(800);
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const measure = () => { if (containerRef.current) setWidth(containerRef.current.clientWidth); };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    const sorted = useMemo(
        () => [...boardElements].sort((a, b) => (a.layer - b.layer) || (a.sortOrder - b.sortOrder)),
        [boardElements],
    );

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        const pointer = stage?.getPointerPosition();
        if (!stage || !pointer) return;
        const mousePointTo = { x: (pointer.x - pos.x) / scale, y: (pointer.y - pos.y) / scale };
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = Math.max(0.3, Math.min(3, scale + direction * 0.1));
        setScale(newScale);
        setPos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    };

    const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };

    if (!boardElements.length) {
        return <p className="text-xs text-slate-500 italic">No tactical board elements.</p>;
    }

    return (
        <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-slate-700/40 bg-slate-950/40" style={{ height }}>
            <button onClick={reset}
                className="absolute top-2 right-2 z-10 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-800/80 text-slate-300 border border-slate-700 hover:text-white">
                <i className="fa-solid fa-expand mr-1"></i>Reset view
            </button>
            <Stage
                width={width} height={height}
                draggable x={pos.x} y={pos.y} scaleX={scale} scaleY={scale}
                onWheel={handleWheel}
                onDragEnd={(e) => setPos({ x: e.target.x(), y: e.target.y() })}
            >
                <Layer>
                    {sorted.map(el => {
                        const color = el.color || ELEMENT_COLORS[el.elementType] || '#94a3b8';

                        if (el.elementType === 'zone' && el.width && el.height) {
                            return (
                                <Group key={el.id} x={el.posX} y={el.posY}>
                                    <Rect width={el.width} height={el.height}
                                        stroke={color + '60'} strokeWidth={2} dash={[8, 4]}
                                        fill={color + '10'} cornerRadius={8} rotation={el.rotation || 0} />
                                    {el.label && (
                                        <KonvaText text={el.label} fill={color} fontSize={10} fontStyle="bold"
                                            width={el.width} align="center" y={(el.height || 0) / 2 - 5} />
                                    )}
                                </Group>
                            );
                        }

                        if (el.elementType === 'line') {
                            const pts = el.data?.points;
                            const hasCustomPoints = Array.isArray(pts) && pts.length >= 4;
                            const isFreehand = !!el.data?.freehand;
                            const linePoints = hasCustomPoints ? (pts as number[]) : [0, 0, el.width || 200, 0];
                            return (
                                <Group key={el.id} x={el.posX} y={el.posY}>
                                    <Line points={linePoints} stroke={color}
                                        strokeWidth={isFreehand ? 3 : 2} lineCap="round" lineJoin="round"
                                        tension={isFreehand ? 0.5 : 0} rotation={el.rotation || 0} />
                                    {el.label && !isFreehand && (
                                        <KonvaText text={el.label} fill={color} fontSize={9} fontStyle="bold"
                                            x={(el.width || 200) + 8} y={-4} />
                                    )}
                                </Group>
                            );
                        }

                        if (el.elementType === 'text') {
                            return (
                                <Group key={el.id} x={el.posX} y={el.posY}>
                                    <KonvaText text={el.label || 'Text'} fill={color} fontSize={14} fontStyle="bold"
                                        rotation={el.rotation || 0} />
                                </Group>
                            );
                        }

                        const symbol = ELEMENT_SYMBOLS[el.elementType] || '★';
                        return (
                            <Group key={el.id} x={el.posX} y={el.posY}>
                                <Circle radius={22} fill={color + '20'} stroke={color + '80'} strokeWidth={2} />
                                <KonvaText text={symbol} fontSize={16} fill={color} offsetX={8} offsetY={8} fontStyle="bold" />
                                {el.label && (
                                    <>
                                        <Rect x={-(Math.max(el.label.length * 5, 20)) / 2} y={26}
                                            width={Math.max(el.label.length * 5, 20)} height={14}
                                            fill="rgba(0,0,0,0.6)" cornerRadius={3} />
                                        <KonvaText text={el.label} fontSize={9} fontStyle="bold" fill="white"
                                            y={28} offsetX={(el.label.length * 4.5) / 2} align="center" />
                                    </>
                                )}
                            </Group>
                        );
                    })}
                </Layer>
            </Stage>
        </div>
    );
};

export default TacticalBoardViewer;
