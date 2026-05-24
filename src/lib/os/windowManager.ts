/**
 * Window manager reducer for Nucleas OS.
 *
 * Pure state transitions for the floating window system. No DOM access here —
 * the React provider wires this to context, persistence, and viewport events.
 */

import type { ModuleDefinition, WindowState, WorkspaceLayout } from './types';

export const INITIAL_Z_INDEX = 10;

export const initialLayout: WorkspaceLayout = {
    windows: [],
    activeWindowId: null,
    nextZIndex: INITIAL_Z_INDEX,
};

export type WindowAction =
    | { type: 'OPEN'; moduleId: string; module: ModuleDefinition; position?: { x: number; y: number } }
    | { type: 'CLOSE'; windowId: string }
    | { type: 'FOCUS'; windowId: string }
    | { type: 'MOVE'; windowId: string; x: number; y: number }
    | { type: 'RESIZE'; windowId: string; width: number; height: number }
    | { type: 'MINIMIZE'; windowId: string }
    | { type: 'MAXIMIZE'; windowId: string }
    | { type: 'RESTORE'; windowId: string }
    | { type: 'HYDRATE'; layout: WorkspaceLayout }
    | { type: 'RESET' };

function generateWindowId(moduleId: string): string {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${moduleId}-${Date.now().toString(36)}-${rand}`;
}

function defaultPosition(module: ModuleDefinition, existingCount: number): { x: number; y: number } {
    const baseX = 80;
    const baseY = 80;
    const offset = (existingCount % 8) * 32;
    return { x: baseX + offset, y: baseY + offset };
}

export function windowReducer(state: WorkspaceLayout, action: WindowAction): WorkspaceLayout {
    switch (action.type) {
        case 'HYDRATE':
            return action.layout;

        case 'RESET':
            return initialLayout;

        case 'OPEN': {
            const z = state.nextZIndex + 1;
            const pos = action.position ?? defaultPosition(action.module, state.windows.length);
            const newWindow: WindowState = {
                id: generateWindowId(action.moduleId),
                moduleId: action.moduleId,
                x: pos.x,
                y: pos.y,
                width: action.module.defaultSize.width,
                height: action.module.defaultSize.height,
                zIndex: z,
                minimized: false,
                maximized: false,
                poppedOut: false,
            };
            return {
                windows: [...state.windows, newWindow],
                activeWindowId: newWindow.id,
                nextZIndex: z,
            };
        }

        case 'CLOSE': {
            const remaining = state.windows.filter((w) => w.id !== action.windowId);
            const activeWindowId =
                state.activeWindowId === action.windowId
                    ? topMostId(remaining)
                    : state.activeWindowId;
            return { ...state, windows: remaining, activeWindowId };
        }

        case 'FOCUS': {
            const target = state.windows.find((w) => w.id === action.windowId);
            if (!target) return state;
            if (state.activeWindowId === action.windowId && target.zIndex === state.nextZIndex) {
                return state;
            }
            const z = state.nextZIndex + 1;
            return {
                ...state,
                activeWindowId: action.windowId,
                nextZIndex: z,
                windows: state.windows.map((w) =>
                    w.id === action.windowId ? { ...w, zIndex: z, minimized: false } : w
                ),
            };
        }

        case 'MOVE':
            return {
                ...state,
                windows: state.windows.map((w) =>
                    w.id === action.windowId ? { ...w, x: action.x, y: action.y } : w
                ),
            };

        case 'RESIZE':
            return {
                ...state,
                windows: state.windows.map((w) =>
                    w.id === action.windowId
                        ? { ...w, width: action.width, height: action.height }
                        : w
                ),
            };

        case 'MINIMIZE': {
            const remaining = state.windows.filter(
                (w) => w.id !== action.windowId && !w.minimized
            );
            const activeWindowId =
                state.activeWindowId === action.windowId
                    ? topMostId(remaining)
                    : state.activeWindowId;
            return {
                ...state,
                activeWindowId,
                windows: state.windows.map((w) =>
                    w.id === action.windowId ? { ...w, minimized: true, maximized: false } : w
                ),
            };
        }

        case 'MAXIMIZE':
            return {
                ...state,
                activeWindowId: action.windowId,
                windows: state.windows.map((w) =>
                    w.id === action.windowId
                        ? { ...w, maximized: !w.maximized, minimized: false }
                        : w
                ),
            };

        case 'RESTORE': {
            const z = state.nextZIndex + 1;
            return {
                ...state,
                activeWindowId: action.windowId,
                nextZIndex: z,
                windows: state.windows.map((w) =>
                    w.id === action.windowId
                        ? { ...w, minimized: false, zIndex: z }
                        : w
                ),
            };
        }

        default:
            return state;
    }
}

function topMostId(windows: WindowState[]): string | null {
    if (windows.length === 0) return null;
    return windows.reduce((top, w) => (w.zIndex > top.zIndex ? w : top), windows[0]).id;
}
