export const PWA_INSTALL_KEYS = {
    seenOnLoad: 'nucleas-os-install-seen-on-load',
    seenOnModules: 'nucleas-os-install-seen-on-modules',
    dismissed: 'nucleas-os-install-dismissed',
    engaged: 'nucleas-os-install-engaged',
    installed: 'nucleas-os-pwa-installed',
} as const;

const INSTALLED_DISPLAY_MODES = [
    'standalone',
    'window-controls-overlay',
    'fullscreen',
    'minimal-ui',
] as const;

export function isOsHost(): boolean {
    if (typeof window === 'undefined') return false;
    return window.location.host.startsWith('os.');
}

function isInstalledDisplayMode(): boolean {
    if (typeof window === 'undefined') return false;
    return INSTALLED_DISPLAY_MODES.some((mode) =>
        window.matchMedia(`(display-mode: ${mode})`).matches
    );
}

export function hasPwaInstalledFlag(): boolean {
    return readFlag(PWA_INSTALL_KEYS.installed);
}

export function markPwaInstalled(): void {
    writeFlag(PWA_INSTALL_KEYS.installed);
}

export function isPwaInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return (
        isInstalledDisplayMode() ||
        nav.standalone === true ||
        hasPwaInstalledFlag()
    );
}

export async function detectPwaInstalledAsync(): Promise<boolean> {
    if (isPwaInstalled()) return true;
    if (typeof window === 'undefined') return false;

    const nav = window.navigator as Navigator & {
        getInstalledRelatedApps?: () => Promise<unknown[]>;
    };
    if (typeof nav.getInstalledRelatedApps === 'function') {
        try {
            const apps = await nav.getInstalledRelatedApps();
            if (apps.length > 0) {
                markPwaInstalled();
                return true;
            }
        } catch {
            // ignore — API may be unavailable or blocked
        }
    }
    return false;
}

function readFlag(key: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return localStorage.getItem(key) === '1';
    } catch {
        return false;
    }
}

function writeFlag(key: string): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, '1');
    } catch {
        // ignore quota / private mode
    }
}

export function hasSeenInstallOnLoad(): boolean {
    return readFlag(PWA_INSTALL_KEYS.seenOnLoad);
}

export function markSeenInstallOnLoad(): void {
    writeFlag(PWA_INSTALL_KEYS.seenOnLoad);
}

export function hasSeenInstallOnModules(): boolean {
    return readFlag(PWA_INSTALL_KEYS.seenOnModules);
}

export function markSeenInstallOnModules(): void {
    writeFlag(PWA_INSTALL_KEYS.seenOnModules);
}

export function isInstallDismissed(): boolean {
    return readFlag(PWA_INSTALL_KEYS.dismissed);
}

export function markInstallDismissed(): void {
    writeFlag(PWA_INSTALL_KEYS.dismissed);
}

export function hasInstallEngaged(): boolean {
    return readFlag(PWA_INSTALL_KEYS.engaged);
}

export function markInstallEngaged(): void {
    writeFlag(PWA_INSTALL_KEYS.engaged);
}

export function shouldShowInstallPrompt(): boolean {
    return isOsHost() && !isPwaInstalled() && !isInstallDismissed();
}
