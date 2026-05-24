import { clampToViewport, type ViewportBounds } from './clampToViewport';
import type { WindowState } from './types';

/** TopBar height (h-12). */
export const OS_INSET_TOP = 48;

/** WindowsTray height (h-14). */
export const OS_INSET_BOTTOM = 56;

export function getOsViewportBounds(): ViewportBounds {
    return {
        width: window.innerWidth,
        height: window.innerHeight,
        insetTop: OS_INSET_TOP,
        insetBottom: OS_INSET_BOTTOM,
    };
}

export function clampWindowToViewport(window: WindowState, bounds: ViewportBounds): WindowState {
    if (window.maximized) return window;
    const clamped = clampToViewport(
        { x: window.x, y: window.y, width: window.width, height: window.height },
        bounds
    );
    return { ...window, x: clamped.x, y: clamped.y, width: clamped.width, height: clamped.height };
}

export function clampLayoutWindows(windows: WindowState[], bounds: ViewportBounds): WindowState[] {
    return windows.map((w) => clampWindowToViewport(w, bounds));
}

export function payloadsMatch(
    a?: Record<string, string>,
    b?: Record<string, string>
): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => a[key] === b[key]);
}
