export const PWA_INSTALL_KEYS = {
    seenOnLoad: 'nucleas-os-install-seen-on-load',
    seenOnModules: 'nucleas-os-install-seen-on-modules',
    dismissed: 'nucleas-os-install-dismissed',
} as const;

export function isOsHost(): boolean {
    if (typeof window === 'undefined') return false;
    return window.location.host.startsWith('os.');
}

export function isPwaInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        nav.standalone === true
    );
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

export function shouldShowInstallPrompt(): boolean {
    return isOsHost() && !isPwaInstalled() && !isInstallDismissed();
}
