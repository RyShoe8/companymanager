'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { initialLayout, windowReducer } from '@/lib/os/windowManager';
import { loadOsState, saveOsState } from '@/lib/os/persistence';
import ModuleRegistry from '@/lib/os/moduleRegistry';
import type { PersistedOsState } from '@/lib/os/types';
import { WindowManagerContext, type WindowManagerContextValue } from './windowManagerContext';

const SAVE_DEBOUNCE_MS = 300;

interface WindowManagerProviderProps {
    children: ReactNode;
    userId: string | null;
}

export default function WindowManagerProvider({ children, userId }: WindowManagerProviderProps) {
    const [layout, dispatch] = useReducer(windowReducer, initialLayout);
    const hydratedRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const persisted = loadOsState(userId);
        if (persisted.layout.windows.length > 0 || persisted.layout.nextZIndex > initialLayout.nextZIndex) {
            dispatch({ type: 'HYDRATE', layout: persisted.layout });
        }
        hydratedRef.current = true;
    }, [userId]);

    useEffect(() => {
        if (!hydratedRef.current) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            const next: PersistedOsState = {
                schemaVersion: 1,
                workspaceId: 'default',
                layout,
                ui: {},
            };
            saveOsState(userId, next);
        }, SAVE_DEBOUNCE_MS);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [layout, userId]);

    const open = useCallback((moduleId: string): string | null => {
        const mod = ModuleRegistry.get(moduleId);
        if (!mod) {
            console.warn(`[OS] Tried to open unknown module: ${moduleId}`);
            return null;
        }
        dispatch({ type: 'OPEN', moduleId, module: mod });
        return moduleId;
    }, []);

    const close = useCallback((windowId: string) => {
        dispatch({ type: 'CLOSE', windowId });
    }, []);

    const focus = useCallback((windowId: string) => {
        dispatch({ type: 'FOCUS', windowId });
    }, []);

    const move = useCallback((windowId: string, x: number, y: number) => {
        dispatch({ type: 'MOVE', windowId, x, y });
    }, []);

    const resize = useCallback((windowId: string, width: number, height: number) => {
        dispatch({ type: 'RESIZE', windowId, width, height });
    }, []);

    const minimize = useCallback((windowId: string) => {
        dispatch({ type: 'MINIMIZE', windowId });
    }, []);

    const maximize = useCallback((windowId: string) => {
        dispatch({ type: 'MAXIMIZE', windowId });
    }, []);

    const restore = useCallback((windowId: string) => {
        dispatch({ type: 'RESTORE', windowId });
    }, []);

    const resetLayout = useCallback(() => {
        dispatch({ type: 'RESET' });
    }, []);

    const value = useMemo<WindowManagerContextValue>(() => {
        const activeWindow = layout.activeWindowId
            ? layout.windows.find((w) => w.id === layout.activeWindowId) ?? null
            : null;
        return {
            layout,
            windows: layout.windows,
            activeWindowId: layout.activeWindowId,
            activeWindow,
            open,
            close,
            focus,
            move,
            resize,
            minimize,
            maximize,
            restore,
            resetLayout,
        };
    }, [layout, open, close, focus, move, resize, minimize, maximize, restore, resetLayout]);

    return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>;
}
