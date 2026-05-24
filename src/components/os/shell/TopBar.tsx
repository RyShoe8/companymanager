'use client';

import { VoiceButton } from '@/components/voice/VoiceOverlay';
import { useWindowManager } from '@/hooks/os/useWindowManager';
import ModuleLauncher from './ModuleLauncher';
import OsInstallPrompt from './OsInstallPrompt';

export default function TopBar() {
    const wm = useWindowManager();
    const activeProjectWindow = wm.windows.find(
        (w) => w.moduleId === 'project-detail' && w.id === wm.activeWindowId
    );
    const projectLabel = activeProjectWindow?.payload?.projectName;

    return (
        <header className="h-12 flex-shrink-0 flex items-center gap-3 px-4 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center gap-2 min-w-[180px]">
                <span className="text-base font-semibold tracking-tight">Nucleas OS</span>
                <span className="text-xs text-zinc-500 truncate max-w-[200px]">
                    {projectLabel ? projectLabel : 'default workspace'}
                </span>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
                <OsInstallPrompt />
                <ModuleLauncher />
                <kbd className="text-[11px] text-zinc-400 bg-zinc-900 px-2 py-1 rounded border border-zinc-700">
                    ⌘K
                </kbd>
                <VoiceButton />
            </div>
        </header>
    );
}
