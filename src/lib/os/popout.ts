import type { ModuleDefinition, WindowState } from './types';
import { computePopoutPlacement, type PopoutPlacementOverride } from './popoutPlacement';

export interface OpenPopoutOptions {
    placement?: PopoutPlacementOverride;
}

function buildPopoutUrl(windowId: string): string {
    const path = `/os/popout?windowId=${encodeURIComponent(windowId)}`;
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
}

export function openPopoutWindow(
    windowState: WindowState,
    module: ModuleDefinition,
    options?: OpenPopoutOptions
): globalThis.Window | null {
    const url = buildPopoutUrl(windowState.id);
    const width = windowState.width || module.defaultSize.width;
    const height = windowState.height || module.defaultSize.height;
    const { left, top } = computePopoutPlacement(windowState, width, height, options?.placement);
    const features = [
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        'popup=yes',
        'menubar=no',
        'toolbar=no',
        'location=no',
        'status=no',
        'scrollbars=yes',
        'noopener',
        'noreferrer',
    ].join(',');
    return globalThis.window.open(url, windowState.id, features);
}

export function focusPopoutWindow(
    windowId: string,
    windowState: WindowState,
    module: ModuleDefinition
): void {
    const existing = openPopoutWindow(windowState, module);
    existing?.focus();
}
