'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    detectInstalledRelatedAppAsync,
    isOsHost,
    isRunningAsInstalledPwa,
    isRunningInBrowserTab,
    markPwaInstalled,
} from '@/lib/os/pwaInstall';

export interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
    const [isRunningAsPwa, setIsRunningAsPwa] = useState(false);
    const [installedRelatedApp, setInstalledRelatedApp] = useState(false);
    const [isOs, setIsOs] = useState(false);
    const [installCheckPending, setInstallCheckPending] = useState(true);
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

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

        let cancelled = false;
        (async () => {
            await refreshInstalled();
            if (!cancelled) setInstallCheckPending(false);
        })();

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
            }
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onAppInstalled);
        window.addEventListener('focus', onVisibilityOrFocus);
        document.addEventListener('visibilitychange', onVisibilityOrFocus);

        return () => {
            cancelled = true;
            mediaQueries.forEach((mq) => mq.removeEventListener('change', onDisplayModeChange));
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onAppInstalled);
            window.removeEventListener('focus', onVisibilityOrFocus);
            document.removeEventListener('visibilitychange', onVisibilityOrFocus);
        };
    }, [refreshInstalled]);

    const canPrompt = Boolean(deferred);

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
        /** @deprecated Use isRunningAsPwa */
        isInstalled: isRunningAsPwa,
        setIsInstalled: (value: boolean) => {
            if (value) setInstalledRelatedApp(true);
            else setInstalledRelatedApp(false);
        },
    };
}
