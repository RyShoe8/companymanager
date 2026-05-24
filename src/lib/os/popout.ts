import type { ModuleDefinition, WindowState } from './types';

export function buildPopoutUrl(windowId: string): string {
    const path = `/os/popout?windowId=${encodeURIComponent(windowId)}`;
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
}

export function openPopoutWindow(
    windowState: WindowState,
    module: ModuleDefinition
): globalThis.Window | null {
    const url = buildPopoutUrl(windowState.id);
    const width = windowState.width || module.defaultSize.width;
    const height = windowState.height || module.defaultSize.height;
    const features = [
        `width=${width}`,
        `height=${height}`,
        'menubar=no',
        'toolbar=no',
        'location=no',
        'status=no',
        'noopener',
        'noreferrer',
    ].join(',');
    return globalThis.window.open(url, windowState.id, features);
}

export function focusPopoutWindow(windowId: string, windowState: WindowState, module: ModuleDefinition): void {
    const existing = openPopoutWindow(windowState, module);
    existing?.focus();
}
