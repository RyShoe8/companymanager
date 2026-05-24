'use client';

import { useOsInstall } from './OsInstallProvider';

export default function OsInstallButton() {
    const { showInstallButton, openInstallModal } = useOsInstall();

    if (!showInstallButton) return null;

    return (
        <button
            type="button"
            onClick={() => openInstallModal()}
            title="Install for chromeless pop-out windows on Windows."
            className="text-xs px-2.5 py-1 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
        >
            Install app
        </button>
    );
}
