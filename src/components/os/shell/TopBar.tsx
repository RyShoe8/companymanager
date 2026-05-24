'use client';

import { VoiceButton } from '@/components/voice/VoiceOverlay';
import { useWindowManager } from '@/hooks/os/useWindowManager';
import ModuleLauncher from './ModuleLauncher';
import OsInstallButton from './OsInstallButton';
import OsAccountMenu from './OsAccountMenu';
import {
    getCommandPaletteShortcutLabel,
    useOsCommandPalette,
} from './OsCommandPaletteContext';

export default function TopBar() {
    const wm = useWindowManager();
    const { openCommandPalette } = useOsCommandPalette();
    const shortcutLabel = getCommandPaletteShortcutLabel();
    const activeProjectWindow = wm.windows.find(
        (w) => w.moduleId === 'project-detail' && w.id === wm.activeWindowId
    );
    const projectLabel = activeProjectWindow?.payload?.projectName;

    return (
        <header className="h-12 flex-shrink-0 flex items-center gap-3 px-4 border-b border-border bg-background">
            <div className="flex items-center gap-2 min-w-[180px]">
                <span className="text-base font-semibold tracking-tight text-text-primary">Nucleas OS</span>
                <span className="text-xs text-text-secondary truncate max-w-[200px]">
                    {projectLabel ? projectLabel : 'default workspace'}
                </span>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
                <OsInstallButton />
                <ModuleLauncher />
                <button
                    type="button"
                    onClick={openCommandPalette}
                    title="Open command palette"
                    aria-label={`Open command palette (${shortcutLabel})`}
                    className="text-[11px] text-text-secondary bg-background-elevated px-2 py-1 rounded border border-border hover:bg-background-card hover:text-text-primary transition-colors cursor-pointer"
                >
                    {shortcutLabel}
                </button>
                <OsAccountMenu />
                <VoiceButton />
            </div>
        </header>
    );
}
