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

export interface PopoutPlacementOverride {
    screenLeft: number;
    screenTop: number;
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

function clampToScreenBounds(
    left: number,
    top: number,
    width: number,
    height: number
): { left: number; top: number } {
    if (cachedScreens && cachedScreens.length > 0) {
        const target =
            cachedScreens.find(
                (s) =>
                    left >= s.availLeft &&
                    left < s.availLeft + s.availWidth &&
                    top >= s.availTop &&
                    top < s.availTop + s.availHeight
            ) ?? cachedScreens[0];

        const maxLeft = target.availLeft + Math.max(0, target.availWidth - width);
        const maxTop = target.availTop + Math.max(0, target.availHeight - height);
        return {
            left: Math.round(Math.min(Math.max(left, target.availLeft), maxLeft)),
            top: Math.round(Math.min(Math.max(top, target.availTop), maxTop)),
        };
    }

    if (typeof window !== 'undefined' && window.screen) {
        const screen = window.screen as Screen & {
            availLeft?: number;
            availTop?: number;
            availWidth?: number;
            availHeight?: number;
        };
        const availLeft = screen.availLeft ?? 0;
        const availTop = screen.availTop ?? 0;
        const availWidth = screen.availWidth ?? screen.width;
        const availHeight = screen.availHeight ?? screen.height;
        const maxLeft = availLeft + Math.max(0, availWidth - width);
        const maxTop = availTop + Math.max(0, availHeight - height);
        return {
            left: Math.round(Math.min(Math.max(left, availLeft), maxLeft)),
            top: Math.round(Math.min(Math.max(top, availTop), maxTop)),
        };
    }

    return { left: Math.round(left), top: Math.round(top) };
}

/** Place a pop-out at explicit screen coordinates (tear-off). */
export function computePopoutPlacementAtScreen(
    screenLeft: number,
    screenTop: number,
    width: number,
    height: number
): PopoutPlacement {
    const { left, top } = clampToScreenBounds(screenLeft, screenTop, width, height);
    return { left, top, width, height };
}

/**
 * Map in-canvas window coordinates to screen coordinates for window.open().
 * When screen bounds are cached, centers the pop-out on the monitor that
 * contains the saved window position.
 */
export function computePopoutPlacement(
    windowState: WindowState,
    width: number,
    height: number,
    override?: PopoutPlacementOverride
): PopoutPlacement {
    if (override) {
        return computePopoutPlacementAtScreen(override.screenLeft, override.screenTop, width, height);
    }

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
