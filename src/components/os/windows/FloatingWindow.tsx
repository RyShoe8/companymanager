'use client';

import { type ReactNode, useCallback } from 'react';
import type { ModuleDefinition, WindowState } from '@/lib/os/types';
import { clampToViewport } from '@/lib/os/clampToViewport';
import { getOsViewportBounds, OS_INSET_BOTTOM, OS_INSET_TOP } from '@/lib/os/viewportBounds';
import { useWindowManager } from '@/hooks/os/useWindowManager';
import { useDraggable } from './useDraggable';
import { useResizable } from './useResizable';

interface FloatingWindowProps {
    window: WindowState;
    module: ModuleDefinition;
    children: ReactNode;
}

export default function FloatingWindow({ window: w, module, children }: FloatingWindowProps) {
    const wm = useWindowManager();

    const handleDrag = useCallback(
        (x: number, y: number) => {
            const clamped = clampToViewport(
                { x, y, width: w.width, height: w.height },
                getOsViewportBounds()
            );
            wm.move(w.id, clamped.x, clamped.y);
        },
        [wm, w.id, w.width, w.height]
    );

    const handleResize = useCallback(
        (width: number, height: number) => {
            const clamped = clampToViewport(
                { x: w.x, y: w.y, width, height },
                getOsViewportBounds()
            );
            wm.move(w.id, clamped.x, clamped.y);
            wm.resize(w.id, clamped.width, clamped.height);
        },
        [wm, w.id, w.x, w.y]
    );

    const { onPointerDown: onHeaderPointerDown, dragging } = useDraggable({
        x: w.x,
        y: w.y,
        onDragStart: () => wm.focus(w.id),
        onDrag: handleDrag,
        disabled: w.maximized,
    });

    const { onPointerDown: onResizePointerDown, resizing } = useResizable({
        width: w.width,
        height: w.height,
        minWidth: module.minSize.width,
        minHeight: module.minSize.height,
        onResize: handleResize,
        disabled: w.maximized,
    });

    const focusOnInteraction = useCallback(() => {
        if (wm.activeWindowId !== w.id) {
            wm.focus(w.id);
        }
    }, [wm, w.id]);

    const isActive = wm.activeWindowId === w.id;
    const windowTitle =
        w.moduleId === 'project-detail' && w.payload?.projectName
            ? w.payload.projectName
            : module.title;

    const style: React.CSSProperties = w.maximized
        ? {
            left: 0,
            top: OS_INSET_TOP,
            width: '100%',
            height: `calc(100vh - ${OS_INSET_TOP}px - ${OS_INSET_BOTTOM}px)`,
            zIndex: w.zIndex,
        }
        : {
            transform: `translate(${w.x}px, ${w.y}px)`,
            width: w.width,
            height: w.height,
            zIndex: w.zIndex,
        };

    return (
        <div
            role="dialog"
            aria-label={windowTitle}
            className={`absolute ${w.maximized ? '' : 'top-0 left-0'} bg-zinc-900 border rounded-lg shadow-2xl flex flex-col overflow-hidden select-none ${
                isActive ? 'border-zinc-600' : 'border-zinc-800'
            } ${dragging || resizing ? '' : 'transition-shadow'}`}
            style={style}
            onPointerDown={focusOnInteraction}
        >
            <div
                onPointerDown={onHeaderPointerDown}
                onDoubleClick={() => wm.maximize(w.id)}
                className={`flex items-center gap-2 px-3 h-9 border-b border-zinc-800 ${
                    w.maximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                } ${isActive ? 'bg-zinc-800/80' : 'bg-zinc-900'}`}
            >
                <span className="text-sm leading-none" aria-hidden>
                    {module.icon}
                </span>
                <span className="flex-1 text-sm font-medium text-zinc-100 truncate">{windowTitle}</span>
                <WindowButton
                    label="Minimize"
                    onClick={(e) => {
                        e.stopPropagation();
                        wm.minimize(w.id);
                    }}
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                        <line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                </WindowButton>
                <WindowButton
                    label={w.maximized ? 'Restore' : 'Maximize'}
                    onClick={(e) => {
                        e.stopPropagation();
                        wm.maximize(w.id);
                    }}
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                        <rect x="2" y="2" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                </WindowButton>
                <WindowButton
                    label="Close"
                    danger
                    onClick={(e) => {
                        e.stopPropagation();
                        wm.close(w.id);
                    }}
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                        <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                </WindowButton>
            </div>

            <div className="flex-1 min-h-0 overflow-auto bg-zinc-950 text-zinc-100">
                {children}
            </div>

            {!w.maximized && (
                <div
                    onPointerDown={onResizePointerDown}
                    aria-label="Resize"
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                    style={{
                        background:
                            'linear-gradient(135deg, transparent 0%, transparent 50%, rgb(82 82 91) 50%, rgb(82 82 91) 60%, transparent 60%, transparent 75%, rgb(82 82 91) 75%, rgb(82 82 91) 85%, transparent 85%)',
                    }}
                />
            )}
        </div>
    );
}

interface WindowButtonProps {
    label: string;
    danger?: boolean;
    onClick: (e: React.MouseEvent) => void;
    children: ReactNode;
}

function WindowButton({ label, onClick, danger, children }: WindowButtonProps) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            onPointerDown={(e) => e.stopPropagation()}
            className={`w-6 h-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-white ${
                danger ? 'hover:bg-red-600' : 'hover:bg-zinc-700'
            }`}
        >
            {children}
        </button>
    );
}
