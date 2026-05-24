'use client';

import { useWindowManager } from '@/hooks/os/useWindowManager';
import ModuleRegistry from '@/lib/os/moduleRegistry';

export default function WindowsTray() {
    const wm = useWindowManager();

    return (
        <footer className="h-14 flex-shrink-0 flex items-center gap-2 px-3 border-t border-zinc-800 bg-zinc-950 overflow-x-auto">
            {wm.windows.length === 0 ? (
                <span className="text-xs text-zinc-600">No open modules. Use the Modules menu or press ⌘K.</span>
            ) : (
                wm.windows.map((w) => {
                    const mod = ModuleRegistry.get(w.moduleId);
                    const isActive = wm.activeWindowId === w.id && !w.minimized;
                    return (
                        <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                                if (w.minimized) wm.restore(w.id);
                                else wm.focus(w.id);
                            }}
                            className={`flex items-center gap-2 h-9 px-3 rounded border text-xs transition-colors ${
                                isActive
                                    ? 'bg-zinc-700 border-zinc-600 text-white'
                                    : w.minimized
                                      ? 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                            }`}
                            aria-pressed={isActive}
                        >
                            <span aria-hidden>{mod?.icon ?? '•'}</span>
                            <span className="truncate max-w-[140px]">{mod?.title ?? w.moduleId}</span>
                            {w.minimized && <span className="text-[10px] text-zinc-500">min</span>}
                        </button>
                    );
                })
            )}
        </footer>
    );
}
