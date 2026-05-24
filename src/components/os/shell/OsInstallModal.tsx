'use client';

import { useEffect } from 'react';

interface OsInstallModalProps {
    isOpen: boolean;
    onClose: () => void;
    canPrompt: boolean;
    isAlreadyInstalled: boolean;
    onInstall: () => Promise<boolean>;
    onDismiss: () => void;
}

export default function OsInstallModal({
    isOpen,
    onClose,
    canPrompt,
    isAlreadyInstalled,
    onInstall,
    onDismiss,
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
                                    ? 'Open Nucleas OS from your taskbar or Start menu for the full desktop experience.'
                                    : 'Run Nucleas as a desktop app for chromeless pop-out windows on Windows.'}
                            </p>
                        </div>
                    </div>

                    {!isAlreadyInstalled && (
                        <div className="rounded-lg border border-border bg-background-elevated px-4 py-3 text-sm text-text-secondary space-y-2">
                            <p className="font-medium text-text-primary">How to install</p>
                            {canPrompt ? (
                                <p>
                                    Click <span className="text-primary">Install Nucleas OS</span> below to open your
                                    browser&apos;s install dialog.
                                </p>
                            ) : (
                                <>
                                    <p className="text-text-muted text-xs">
                                        One-click install is not available in this browser session yet. Use the browser menu:
                                    </p>
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Open the browser menu (⋮) in Chrome or Edge</li>
                                        <li>
                                            Choose <span className="text-text-primary">Install Nucleas OS</span> or{' '}
                                            <span className="text-text-primary">Install app</span>
                                        </li>
                                        <li>Confirm the install prompt</li>
                                    </ol>
                                </>
                            )}
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
