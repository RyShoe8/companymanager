'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function OsInstallPrompt() {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setHidden(true);
            return;
        }

        const onBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setDeferred(event as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    }, []);

    if (hidden || !deferred) return null;

    const install = async () => {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
    };

    return (
        <button
            type="button"
            onClick={install}
            title="Install for chromeless pop-out windows on Windows."
            className="text-xs px-2.5 py-1 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
        >
            Install app
        </button>
    );
}
