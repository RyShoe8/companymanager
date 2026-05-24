'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    detectInstalledRelatedAppAsync,
    isInstallDismissed,
    isOsHost,
    isRunningAsInstalledPwa,
    isRunningInBrowserTab,
    markPwaInstalled,
} from '@/lib/os/pwaInstall';
import {
    getOsSwState,
    subscribeOsSwState,
    type OsSwStatus,
} from '@/lib/os/pwaServiceWorker';

export interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallabilityHint = 'ready' | 'dismissed' | 'no-prompt-yet';

async function checkManifestReachable(): Promise<boolean> {
    try {
        const res = await fetch('/nucleas-os.webmanifest', { cache: 'no-store' });
        if (!res.ok) return false;
        const data = await res.json();
        return Boolean(data?.name && Array.isArray(data?.icons) && data.icons.length > 0);
    } catch {
        return false;
    }
}

export function usePwaInstall() {
    const [isRunningAsPwa, setIsRunningAsPwa] = useState(false);
    const [installedRelatedApp, setInstalledRelatedApp] = useState(false);
    const [isOs, setIsOs] = useState(false);
    const [installCheckPending, setInstallCheckPending] = useState(true);
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    const [swStatus, setSwStatus] = useState<OsSwStatus>('idle');
    const [swErrorMessage, setSwErrorMessage] = useState<string | null>(null);
    const [manifestOk, setManifestOk] = useState<boolean | null>(null);

    const syncSwState = useCallback(() => {
        const { status, errorMessage } = getOsSwState();
        setSwStatus(status);
        setSwErrorMessage(errorMessage);
    }, []);

    const refreshInstalled = useCallback(async () => {
        const runningAsPwa = isRunningAsInstalledPwa();
        setIsRunningAsPwa(runningAsPwa);
        if (runningAsPwa) {
            setInstalledRelatedApp(false);
            return true;
        }
        const related = await detectInstalledRelatedAppAsync();
        setInstalledRelatedApp(related);
        return related;
    }, []);

    useEffect(() => {
        setIsOs(isOsHost());
        setIsRunningAsPwa(isRunningAsInstalledPwa());
        setInstalledRelatedApp(false);
        syncSwState();

        let cancelled = false;
        (async () => {
            const [manifestReachable] = await Promise.all([
                isOsHost() ? checkManifestReachable() : Promise.resolve(true),
                refreshInstalled(),
            ]);
            if (!cancelled) {
                setManifestOk(manifestReachable);
                setInstallCheckPending(false);
            }
        })();

        const unsubSw = subscribeOsSwState(syncSwState);

        const onDisplayModeChange = () => {
            void refreshInstalled();
        };

        const mediaQueries = [
            '(display-mode: standalone)',
            '(display-mode: window-controls-overlay)',
            '(display-mode: fullscreen)',
            '(display-mode: minimal-ui)',
        ].map((q) => window.matchMedia(q));

        mediaQueries.forEach((mq) => mq.addEventListener('change', onDisplayModeChange));

        const onBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setDeferred(event as BeforeInstallPromptEvent);
        };

        const onAppInstalled = () => {
            markPwaInstalled();
            setInstalledRelatedApp(true);
            setDeferred(null);
        };

        const onVisibilityOrFocus = () => {
            if (document.visibilityState === 'visible') {
                void refreshInstalled();
                if (isOsHost()) {
                    void checkManifestReachable().then(setManifestOk);
                }
            }
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onAppInstalled);
        window.addEventListener('focus', onVisibilityOrFocus);
        document.addEventListener('visibilitychange', onVisibilityOrFocus);

        return () => {
            cancelled = true;
            unsubSw();
            mediaQueries.forEach((mq) => mq.removeEventListener('change', onDisplayModeChange));
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onAppInstalled);
            window.removeEventListener('focus', onVisibilityOrFocus);
            document.removeEventListener('visibilitychange', onVisibilityOrFocus);
        };
    }, [refreshInstalled, syncSwState]);

    const canPrompt = Boolean(deferred);

    const installabilityHint: InstallabilityHint = canPrompt
        ? 'ready'
        : isInstallDismissed()
          ? 'dismissed'
          : 'no-prompt-yet';

    const promptInstall = useCallback(async (): Promise<boolean> => {
        if (!deferred) return false;
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        setDeferred(null);
        if (outcome === 'accepted') {
            markPwaInstalled();
            setInstalledRelatedApp(true);
            return true;
        }
        return false;
    }, [deferred]);

    const inBrowserTab = isOs && isRunningInBrowserTab();

    return {
        isOsHost: isOs,
        isRunningAsPwa,
        installedRelatedApp,
        isRunningInBrowserTab: inBrowserTab,
        installCheckPending,
        canPrompt,
        promptInstall,
        refreshInstalled,
        swStatus,
        swErrorMessage,
        manifestOk,
        installabilityHint,
        /** @deprecated Use isRunningAsPwa */
        isInstalled: isRunningAsPwa,
        setIsInstalled: (value: boolean) => {
            if (value) setInstalledRelatedApp(true);
            else setInstalledRelatedApp(false);
        },
    };
}
