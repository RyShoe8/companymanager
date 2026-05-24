export type OsSwStatus = 'idle' | 'registering' | 'active' | 'pending' | 'error' | 'unsupported';

type SwState = {
    status: OsSwStatus;
    errorMessage: string | null;
};

let state: SwState = { status: 'idle', errorMessage: null };
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((cb) => cb());
}

export function getOsSwState(): SwState {
    return state;
}

export function subscribeOsSwState(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

function setState(status: OsSwStatus, errorMessage: string | null = null) {
    state = { status, errorMessage };
    notify();
}

/** Register the OS service worker; no-op outside os.* host. */
export async function registerOsServiceWorker(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!window.location.host.startsWith('os.')) {
        setState('idle');
        return;
    }
    if (!('serviceWorker' in navigator)) {
        setState('unsupported', 'Service workers are not supported in this browser.');
        return;
    }

    setState('registering');
    try {
        const registration = await navigator.serviceWorker.register('/os-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;

        if (navigator.serviceWorker.controller || registration.active) {
            setState('active');
        } else {
            setState('pending', 'Reload this page once to activate the service worker.');
        }
    } catch (err) {
        setState('error', err instanceof Error ? err.message : 'Service worker registration failed.');
    }
}
