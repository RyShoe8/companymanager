'use client';

import { createContext } from 'react';
import type { OpenWindowOptions, WindowState, WorkspaceLayout } from '@/lib/os/types';
import type { PopoutPlacementOverride } from '@/lib/os/popoutPlacement';

export interface PopOutOptions {
    placement?: PopoutPlacementOverride;
}

interface WindowManagerActions {
    open: (moduleId: string, options?: OpenWindowOptions) => string | null;
    close: (windowId: string) => void;
    focus: (windowId: string) => void;
    move: (windowId: string, x: number, y: number) => void;
    resize: (windowId: string, width: number, height: number) => void;
    minimize: (windowId: string) => void;
    maximize: (windowId: string) => void;
    restore: (windowId: string) => void;
    resetLayout: () => void;
    popOut: (windowId: string, options?: PopOutOptions) => boolean;
    popIn: (windowId: string) => void;
    focusPopout: (windowId: string) => void;
}

export interface WindowManagerContextValue extends WindowManagerActions {
    layout: WorkspaceLayout;
    windows: WindowState[];
    activeWindowId: string | null;
    activeWindow: WindowState | null;
}

export const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);
