'use client';

import { useEffect, useRef, useState } from 'react';
import { useModuleRegistry } from '@/hooks/os/useModuleRegistry';
import { useWindowManager } from '@/hooks/os/useWindowManager';

export default function ModuleLauncher() {
    const modules = useModuleRegistry();
    const wm = useWindowManager();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        window.addEventListener('mousedown', onDown);
        return () => window.removeEventListener('mousedown', onDown);
    }, [open]);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="px-3 h-8 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sm flex items-center gap-2"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <span aria-hidden>＋</span>
                <span>Modules</span>
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl z-50 overflow-hidden"
                >
                    <div className="px-3 py-2 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                        Open module
                    </div>
                    {modules.filter((m) => !m.launcherHidden).length === 0 ? (
                        <div className="px-3 py-4 text-sm text-zinc-500">No modules registered.</div>
                    ) : (
                        <ul>
                            {modules.filter((m) => !m.launcherHidden).map((m) => (
                                <li key={m.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            wm.open(m.id);
                                            setOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-800"
                                        role="menuitem"
                                    >
                                        <span className="text-base" aria-hidden>
                                            {m.icon}
                                        </span>
                                        <span className="flex-1 text-zinc-100">{m.title}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
