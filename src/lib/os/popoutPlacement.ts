import type { WindowState } from './types';

export interface ScreenBounds {
    availLeft: number;
    availTop: number;
    availWidth: number;
    availHeight: number;
}

export interface PopoutPlacement {
    left: number;
    top: number;
    width: number;
    height: number;
}

let cachedScreens: ScreenBounds[] | null = null;

/** Preload multi-monitor bounds when the Window Management API is available. */
export async function warmPopoutScreenCache(): Promise<void> {
    if (typeof window === 'undefined' || !('getScreenDetails' in window)) return;
    try {
        const details = await (
            window as Window & { getScreenDetails(): Promise<{ screens: ScreenBounds[] }> }
        ).getScreenDetails();
        cachedScreens = details.screens;
    } catch {
        // Permission denied or unsupported — fall back to screenX/screenY placement.
    }
}

/**
 * Map in-canvas window coordinates to screen coordinates for window.open().
 * When screen bounds are cached, centers the pop-out on the monitor that
 * contains the saved window position.
 */
export function computePopoutPlacement(
    windowState: WindowState,
    width: number,
    height: number
): PopoutPlacement {
    const screenX = typeof window !== 'undefined' ? window.screenX : 0;
    const screenY = typeof window !== 'undefined' ? window.screenY : 0;
    const canvasScreenX = screenX + windowState.x;
    const canvasScreenY = screenY + windowState.y;

    if (cachedScreens && cachedScreens.length > 0) {
        const target = cachedScreens.find(
            (s) =>
                canvasScreenX >= s.availLeft &&
                canvasScreenX < s.availLeft + s.availWidth &&
                canvasScreenY >= s.availTop &&
                canvasScreenY < s.availTop + s.availHeight
        );
        if (target) {
            return {
                left: Math.round(target.availLeft + Math.max(0, (target.availWidth - width) / 2)),
                top: Math.round(target.availTop + Math.max(0, (target.availHeight - height) / 2)),
                width,
                height,
            };
        }
    }

    return {
        left: Math.round(canvasScreenX),
        top: Math.round(canvasScreenY),
        width,
        height,
    };
}
