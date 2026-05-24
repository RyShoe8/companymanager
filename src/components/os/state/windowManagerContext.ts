'use client';

import { createContext } from 'react';
import type { WindowState, WorkspaceLayout } from '@/lib/os/types';

export interface WindowManagerActions {
    open: (moduleId: string) => string | null;
    close: (windowId: string) => void;
    focus: (windowId: string) => void;
    move: (windowId: string, x: number, y: number) => void;
    resize: (windowId: string, width: number, height: number) => void;
    minimize: (windowId: string) => void;
    maximize: (windowId: string) => void;
    restore: (windowId: string) => void;
    resetLayout: () => void;
}

export interface WindowManagerContextValue extends WindowManagerActions {
    layout: WorkspaceLayout;
    windows: WindowState[];
    activeWindowId: string | null;
    activeWindow: WindowState | null;
}

export const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);
