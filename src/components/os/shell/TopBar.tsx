'use client';

import { VoiceButton } from '@/components/voice/VoiceOverlay';
import ModuleLauncher from './ModuleLauncher';

export default function TopBar() {
    return (
        <header className="h-12 flex-shrink-0 flex items-center gap-3 px-4 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center gap-2 min-w-[180px]">
                <span className="text-base font-semibold tracking-tight">Nucleas OS</span>
                <span className="text-xs text-zinc-500">default workspace</span>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
                <ModuleLauncher />
                <kbd className="text-[11px] text-zinc-400 bg-zinc-900 px-2 py-1 rounded border border-zinc-700">
                    ⌘K
                </kbd>
                <VoiceButton />
            </div>
        </header>
    );
}
