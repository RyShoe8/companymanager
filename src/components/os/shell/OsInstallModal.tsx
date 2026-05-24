'use client';

import { useEffect } from 'react';
import type { InstallabilityHint } from '@/hooks/os/usePwaInstall';
import type { OsSwStatus } from '@/lib/os/pwaServiceWorker';

interface OsInstallModalProps {
    isOpen: boolean;
    onClose: () => void;
    canPrompt: boolean;
    isAlreadyInstalled: boolean;
    showMenuInstallConfirm: boolean;
    swStatus: OsSwStatus;
    swErrorMessage: string | null;
    manifestOk: boolean | null;
    installDismissed: boolean;
    installabilityHint: InstallabilityHint;
    onInstall: () => Promise<boolean>;
    onDismiss: () => void;
    onConfirmMenuInstall: () => void;
}

function swStatusLabel(status: OsSwStatus): string {
    switch (status) {
        case 'active':
            return 'Active';
        case 'registering':
            return 'Registering…';
        case 'pending':
            return 'Pending (reload may be required)';
        case 'error':
            return 'Error';
        case 'unsupported':
            return 'Not supported';
        default:
            return 'Not started';
    }
}

export default function OsInstallModal({
    isOpen,
    onClose,
    canPrompt,
    isAlreadyInstalled,
    showMenuInstallConfirm,
    swStatus,
    swErrorMessage,
    manifestOk,
    installDismissed,
    installabilityHint,
    onInstall,
    onDismiss,
    onConfirmMenuInstall,
}: OsInstallModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleInstall = async () => {
        if (!canPrompt) return;
        const ok = await onInstall();
        if (ok) onClose();
    };

    const handleNotNow = () => {
        onDismiss();
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-nucleas-ink/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="os-install-title"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-xl border border-border bg-background-card shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-1 w-full bg-gradient-to-r from-nucleas-primary via-nucleas-secondary to-nucleas-fourth" />

                <div className="p-6 space-y-5">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-xl font-bold">
                            N
                        </div>
                        <div>
                            <h2 id="os-install-title" className="text-lg font-semibold text-text-primary">
                                {isAlreadyInstalled ? 'Nucleas OS is installed' : 'Install Nucleas OS'}
                            </h2>
                            <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                                {isAlreadyInstalled
                                    ? 'You are in the browser. Open Nucleas OS from your taskbar or Start menu for the full desktop experience and chromeless pop-out windows.'
                                    : 'Install Nucleas as a desktop app for chromeless pop-out windows on Windows.'}
                            </p>
                        </div>
                    </div>

                    {!isAlreadyInstalled && (
                        <div className="rounded-lg border border-border bg-background-elevated px-4 py-3 text-sm text-text-secondary space-y-3">
                            {canPrompt ? (
                                <>
                                    <p className="font-medium text-text-primary">One-click install</p>
                                    <p>
                                        Click <span className="text-primary">Install Nucleas OS</span> below to open
                                        your browser&apos;s install dialog.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="font-medium text-text-primary">Install from your browser menu</p>
                                    <p className="text-text-muted text-xs">
                                        The in-app install button is not available yet. Use Chrome or Edge on Windows:
                                    </p>
                                    <ol className="list-decimal list-inside space-y-1.5">
                                        <li>
                                            Look for an <span className="text-text-primary">Install</span> icon in the
                                            address bar, or open the menu (⋮)
                                        </li>
                                        <li>
                                            Choose <span className="text-text-primary">Install Nucleas OS</span>,{' '}
                                            <span className="text-text-primary">Apps</span> →{' '}
                                            <span className="text-text-primary">Install this site as an app</span>
                                        </li>
                                        <li>Confirm the install prompt</li>
                                        <li>
                                            Open the app from <span className="text-text-primary">Start</span> or the
                                            taskbar (a Desktop shortcut is optional on Windows)
                                        </li>
                                    </ol>
                                </>
                            )}
                        </div>
                    )}

                    <div className="rounded-lg border border-border/80 bg-background/50 px-3 py-2 text-xs text-text-muted space-y-1">
                        <p>
                            <span className="text-text-secondary">Service worker:</span>{' '}
                            {swStatusLabel(swStatus)}
                            {swErrorMessage ? ` — ${swErrorMessage}` : ''}
                        </p>
                        <p>
                            <span className="text-text-secondary">Manifest:</span>{' '}
                            {manifestOk === null ? 'Checking…' : manifestOk ? 'OK' : 'Not reachable'}
                        </p>
                        {installDismissed && (
                            <p className="text-amber-400/90">Install reminders were dismissed earlier (Not now).</p>
                        )}
                        {!canPrompt && installabilityHint === 'no-prompt-yet' && (
                            <p>Spend a moment on this page, then check the browser menu for Install.</p>
                        )}
                    </div>

                    {showMenuInstallConfirm && (
                        <div className="text-center text-xs text-text-muted space-y-1">
                            <p>Finished installing from the browser menu?</p>
                            <button
                                type="button"
                                onClick={onConfirmMenuInstall}
                                className="text-primary hover:underline font-medium"
                            >
                                I installed it from the menu
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                        {isAlreadyInstalled ? (
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm rounded-lg bg-primary text-nucleas-ink font-medium hover:bg-primary-hover transition-colors"
                            >
                                Close
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={handleNotNow}
                                    className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-background-elevated hover:text-text-primary transition-colors"
                                >
                                    Not now
                                </button>
                                {canPrompt ? (
                                    <button
                                        type="button"
                                        onClick={handleInstall}
                                        className="px-4 py-2 text-sm rounded-lg bg-primary text-nucleas-ink font-medium hover:bg-primary-hover transition-colors"
                                    >
                                        Install Nucleas OS
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm rounded-lg bg-primary/15 border border-primary/40 text-primary font-medium hover:bg-primary/25 transition-colors"
                                    >
                                        Close
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
