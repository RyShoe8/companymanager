'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { registerOsModules } from '@/components/os/modules/registerModules';
import { useOsAuth } from '@/hooks/os/useOsAuth';
import { useWindowManager } from '@/hooks/os/useWindowManager';
import ModuleRegistry from '@/lib/os/moduleRegistry';
import { subscribePopoutSync } from '@/lib/os/popoutSync';
import WindowManagerProvider from '@/components/os/state/WindowManagerProvider';

registerOsModules();

export default function PopoutRoot() {
    const auth = useOsAuth();

    return (
        <WindowManagerProvider userId={auth.userId}>
            <Suspense fallback={<PopoutLoading />}>
                <PopoutContent />
            </Suspense>
        </WindowManagerProvider>
    );
}

function PopoutLoading() {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-sm">
            Loading module…
        </div>
    );
}

function PopoutContent() {
    const searchParams = useSearchParams();
    const windowId = searchParams.get('windowId');
    const wm = useWindowManager();
    const syncRef = useRef<ReturnType<typeof subscribePopoutSync> | null>(null);

    useEffect(() => {
        syncRef.current = subscribePopoutSync(() => {});
        return () => syncRef.current?.close();
    }, []);

    useEffect(() => {
        const onBeforeUnload = () => {
            if (!windowId) return;
            syncRef.current?.publish({ type: 'POP_IN', windowId });
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [windowId]);

    const target = useMemo(
        () => (windowId ? wm.windows.find((w) => w.id === windowId) : null),
        [wm.windows, windowId]
    );

    const module = target ? ModuleRegistry.get(target.moduleId) : null;

    const title =
        target?.moduleId === 'project-detail' && target.payload?.projectName
            ? target.payload.projectName
            : module?.title ?? 'Module';

    const dockBack = useCallback(() => {
        if (!windowId) return;
        syncRef.current?.publish({ type: 'POP_IN', windowId });
        wm.popIn(windowId);
        window.close();
    }, [windowId, wm]);

    const closeModule = useCallback(() => {
        if (!windowId) return;
        syncRef.current?.publish({ type: 'CLOSE', windowId });
        wm.close(windowId);
        window.close();
    }, [windowId, wm]);

    if (!windowId) {
        return <PopoutError message="Missing windowId parameter." />;
    }

    if (!target) {
        if (wm.windows.length === 0) {
            return <PopoutLoading />;
        }
        return <PopoutError message="Module window not found. It may have been closed in the main workspace." />;
    }

    if (!module) {
        return <PopoutError message="Unknown module type." />;
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
            <header className="h-10 flex-shrink-0 flex items-center gap-2 px-3 border-b border-zinc-800 bg-zinc-900">
                <span className="text-sm" aria-hidden>
                    {module.icon}
                </span>
                <span className="flex-1 text-sm font-medium truncate">{title}</span>
                <button
                    type="button"
                    onClick={dockBack}
                    className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800"
                >
                    Dock back
                </button>
                <button
                    type="button"
                    onClick={closeModule}
                    aria-label="Close"
                    className="w-7 h-7 inline-flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-red-600"
                >
                    ×
                </button>
            </header>
            <main className="flex-1 min-h-0 overflow-auto">
                {module.render({
                    windowId: target.id,
                    moduleId: target.moduleId,
                    payload: target.payload,
                })}
            </main>
        </div>
    );
}

function PopoutError({ message }: { message: string }) {
    return (
        <div className="min-h-screen bg-zinc-950 text-red-400 flex items-center justify-center p-6 text-sm text-center">
            {message}
        </div>
    );
}
