'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    detectPwaInstalledAsync,
    isOsHost,
    isPwaInstalled,
    markPwaInstalled,
} from '@/lib/os/pwaInstall';

export interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
    const [isInstalled, setIsInstalled] = useState(false);
    const [isOs, setIsOs] = useState(false);
    const [installCheckPending, setInstallCheckPending] = useState(true);
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

    const refreshInstalled = useCallback(async () => {
        const sync = isPwaInstalled();
        if (sync) {
            setIsInstalled(true);
            return true;
        }
        const asyncResult = await detectPwaInstalledAsync();
        setIsInstalled(asyncResult);
        return asyncResult;
    }, []);

    useEffect(() => {
        setIsOs(isOsHost());
        setIsInstalled(isPwaInstalled());

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
            setIsInstalled(true);
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
            setIsInstalled(true);
            return true;
        }
        return false;
    }, [deferred]);

    return {
        isOsHost: isOs,
        isInstalled,
        setIsInstalled,
        installCheckPending,
        canPrompt,
        promptInstall,
        refreshInstalled,
    };
}
