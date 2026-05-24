'use client';

import { useContext } from 'react';
import {
    WindowManagerContext,
    type WindowManagerContextValue,
} from '@/components/os/state/windowManagerContext';

export function useWindowManager(): WindowManagerContextValue {
    const ctx = useContext(WindowManagerContext);
    if (!ctx) {
        throw new Error('useWindowManager must be used within WindowManagerProvider');
    }
    return ctx;
}
