'use client';

import { useCallback, useEffect, useState } from 'react';
import { isOsHost, isPwaInstalled, markInstallDismissed } from '@/lib/os/pwaInstall';

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

        const onDisplayModeChange = () => setIsInstalled(isPwaInstalled());
        const mq = window.matchMedia('(display-mode: standalone)');
        mq.addEventListener('change', onDisplayModeChange);

        const onBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setDeferred(event as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        return () => {
            mq.removeEventListener('change', onDisplayModeChange);
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
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

    const dismiss = useCallback(() => {
        markInstallDismissed();
    }, []);

    return {
        isOsHost: isOs,
        isInstalled,
        canPrompt,
        promptInstall,
        dismiss,
    };
}
