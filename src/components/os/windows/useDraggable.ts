'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface DraggableOptions {
    /** Current position, controlled. */
    x: number;
    y: number;
    onDragStart?: () => void;
    onDrag?: (x: number, y: number) => void;
    onDragEnd?: (x: number, y: number, event: PointerEvent) => void;
    disabled?: boolean;
}

interface DragState {
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startX: number;
    startY: number;
}

/**
 * Generic drag hook for floating windows. Uses Pointer Events so it works
 * with mouse, touch, and stylus. The element's actual position must be
 * controlled by the consumer via the `onDrag` callback.
 */
export function useDraggable({ x, y, onDragStart, onDrag, onDragEnd, disabled }: DraggableOptions) {
    const dragRef = useRef<DragState | null>(null);
    const [dragging, setDragging] = useState(false);

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLElement>) => {
            if (disabled) return;
            if (e.button !== 0) return;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = {
                pointerId: e.pointerId,
                startPointerX: e.clientX,
                startPointerY: e.clientY,
                startX: x,
                startY: y,
            };
            setDragging(true);
            onDragStart?.();
        },
        [x, y, onDragStart, disabled]
    );

    useEffect(() => {
        if (!dragging) return;

        const onMove = (e: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== e.pointerId) return;
            const dx = e.clientX - drag.startPointerX;
            const dy = e.clientY - drag.startPointerY;
            onDrag?.(drag.startX + dx, drag.startY + dy);
        };

        const finish = (e: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== e.pointerId) return;
            const dx = e.clientX - drag.startPointerX;
            const dy = e.clientY - drag.startPointerY;
            dragRef.current = null;
            setDragging(false);
            onDragEnd?.(drag.startX + dx, drag.startY + dy, e);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', finish);
        };
    }, [dragging, onDrag, onDragEnd]);

    return { onPointerDown, dragging };
}
