'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ResizableOptions {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    onResize?: (width: number, height: number) => void;
    onResizeEnd?: (width: number, height: number) => void;
    disabled?: boolean;
}

interface ResizeState {
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startWidth: number;
    startHeight: number;
}

/**
 * SE-corner resize hook for floating windows. Uses Pointer Events.
 */
export function useResizable({
    width,
    height,
    minWidth,
    minHeight,
    onResize,
    onResizeEnd,
    disabled,
}: ResizableOptions) {
    const stateRef = useRef<ResizeState | null>(null);
    const [resizing, setResizing] = useState(false);

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLElement>) => {
            if (disabled) return;
            if (e.button !== 0) return;
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            stateRef.current = {
                pointerId: e.pointerId,
                startPointerX: e.clientX,
                startPointerY: e.clientY,
                startWidth: width,
                startHeight: height,
            };
            setResizing(true);
        },
        [width, height, disabled]
    );

    useEffect(() => {
        if (!resizing) return;

        const onMove = (e: PointerEvent) => {
            const s = stateRef.current;
            if (!s || s.pointerId !== e.pointerId) return;
            const w = Math.max(minWidth, s.startWidth + (e.clientX - s.startPointerX));
            const h = Math.max(minHeight, s.startHeight + (e.clientY - s.startPointerY));
            onResize?.(w, h);
        };

        const finish = (e: PointerEvent) => {
            const s = stateRef.current;
            if (!s || s.pointerId !== e.pointerId) return;
            const w = Math.max(minWidth, s.startWidth + (e.clientX - s.startPointerX));
            const h = Math.max(minHeight, s.startHeight + (e.clientY - s.startPointerY));
            stateRef.current = null;
            setResizing(false);
            onResizeEnd?.(w, h);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', finish);
        };
    }, [resizing, minWidth, minHeight, onResize, onResizeEnd]);

    return { onPointerDown, resizing };
}
