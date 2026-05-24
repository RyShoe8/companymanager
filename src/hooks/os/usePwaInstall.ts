'use client';

import { useCallback, useEffect, useState } from 'react';
import { isOsHost, isPwaInstalled } from '@/lib/os/pwaInstall';

export interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
    const [isInstalled, setIsInstalled] = useState(false);
    const [isOs, setIsOs] = useState(false);
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        setIsOs(isOsHost());
        setIsInstalled(isPwaInstalled());

        const refreshInstalled = () => setIsInstalled(isPwaInstalled());

        const mq = window.matchMedia('(display-mode: standalone)');
        mq.addEventListener('change', refreshInstalled);

        const onBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setDeferred(event as BeforeInstallPromptEvent);
        };

        const onAppInstalled = () => {
            setIsInstalled(true);
            setDeferred(null);
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onAppInstalled);
        return () => {
            mq.removeEventListener('change', refreshInstalled);
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onAppInstalled);
        };
    }, []);

    const canPrompt = Boolean(deferred);

    const promptInstall = useCallback(async (): Promise<boolean> => {
        if (!deferred) return false;
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        setDeferred(null);
        if (outcome === 'accepted') {
            setIsInstalled(true);
            return true;
        }
        return false;
    }, [deferred]);

    return {
        isOsHost: isOs,
        isInstalled,
        setIsInstalled,
        canPrompt,
        promptInstall,
    };
}
