'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface OsCommandPaletteContextValue {
    openCommandPalette: () => void;
    toggleCommandPalette: () => void;
}

const OsCommandPaletteContext = createContext<OsCommandPaletteContextValue | null>(null);

export function OsCommandPaletteProvider({
    children,
    openCommandPalette,
    toggleCommandPalette,
}: {
    children: ReactNode;
    openCommandPalette: () => void;
    toggleCommandPalette: () => void;
}) {
    return (
        <OsCommandPaletteContext.Provider value={{ openCommandPalette, toggleCommandPalette }}>
            {children}
        </OsCommandPaletteContext.Provider>
    );
}

export function useOsCommandPalette(): OsCommandPaletteContextValue {
    const ctx = useContext(OsCommandPaletteContext);
    if (!ctx) {
        throw new Error('useOsCommandPalette must be used within OsCommandPaletteProvider');
    }
    return ctx;
}

/** Platform-appropriate shortcut label for the command palette. */
export function getCommandPaletteShortcutLabel(): string {
    if (typeof navigator === 'undefined') return '⌘K';
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
    return isMac ? '⌘K' : 'Ctrl+K';
}
