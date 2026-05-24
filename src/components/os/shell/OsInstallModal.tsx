'use client';

import Modal from '@/components/ui/Modal';

interface OsInstallModalProps {
    isOpen: boolean;
    onClose: () => void;
    canPrompt: boolean;
    onInstall: () => Promise<void>;
    onDismiss: () => void;
}

export default function OsInstallModal({
    isOpen,
    onClose,
    canPrompt,
    onInstall,
    onDismiss,
}: OsInstallModalProps) {
    const handleInstall = async () => {
        await onInstall();
        onClose();
    };

    const handleNotNow = () => {
        onDismiss();
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleNotNow}
            title="Install Nucleas OS"
            maxWidth="md"
            stackAboveOverlays
        >
            <div className="space-y-4 text-sm text-zinc-300">
                <p>
                    Install Nucleas OS as a desktop app for chromeless pop-out windows on Windows.
                    Modules you pop out will open without the browser address bar.
                </p>

                {!canPrompt && (
                    <div className="rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-zinc-400">
                        <p className="font-medium text-zinc-200 mb-1">Manual install</p>
                        <p>
                            In Chrome or Edge, open the browser menu and choose{' '}
                            <span className="text-zinc-200">Install Nucleas OS</span> or{' '}
                            <span className="text-zinc-200">Install app</span>.
                        </p>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={handleNotNow}
                        className="px-3 py-1.5 text-sm rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                        Not now
                    </button>
                    <button
                        type="button"
                        onClick={handleInstall}
                        className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500"
                    >
                        Install
                    </button>
                </div>
            </div>
        </Modal>
    );
}
