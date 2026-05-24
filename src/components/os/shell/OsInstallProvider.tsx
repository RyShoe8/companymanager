'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { usePwaInstall } from '@/hooks/os/usePwaInstall';
import {
    hasSeenInstallOnLoad,
    isInstallDismissed,
    markInstallDismissed,
    markInstallEngaged,
    markSeenInstallOnLoad,
} from '@/lib/os/pwaInstall';
import OsInstallModal from './OsInstallModal';

interface OsInstallContextValue {
    openInstallModal: (onClose?: () => void) => void | Promise<void>;
    isInstalled: boolean;
    showInstallButton: boolean;
}

const OsInstallContext = createContext<OsInstallContextValue | null>(null);

export function useOsInstall(): OsInstallContextValue {
    const ctx = useContext(OsInstallContext);
    if (!ctx) {
        throw new Error('useOsInstall must be used within OsInstallProvider');
    }
    return ctx;
}

export function OsInstallProvider({ children }: { children: ReactNode }) {
    const {
        isOsHost,
        isInstalled,
        setIsInstalled,
        installCheckPending,
        canPrompt,
        promptInstall,
        refreshInstalled,
    } = usePwaInstall();
    const [modalOpen, setModalOpen] = useState(false);
    const onCloseRef = useRef<(() => void) | null>(null);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        const cb = onCloseRef.current;
        onCloseRef.current = null;
        cb?.();
    }, []);

    const openInstallModal = useCallback(
        async (onClose?: () => void) => {
            const installed = await refreshInstalled();
            if (installed) {
                setIsInstalled(true);
                onClose?.();
                return;
            }
            onCloseRef.current = onClose ?? null;
            setModalOpen(true);
        },
        [refreshInstalled, setIsInstalled]
    );

    useEffect(() => {
        if (!isOsHost || installCheckPending || isInstalled || isInstallDismissed() || hasSeenInstallOnLoad()) {
            return;
        }
        markSeenInstallOnLoad();
        setModalOpen(true);
    }, [isOsHost, isInstalled, installCheckPending]);

    const handleInstall = useCallback(async (): Promise<boolean> => {
        markInstallEngaged();
        if (!canPrompt) return false;
        return promptInstall();
    }, [canPrompt, promptInstall]);

    const handleDismiss = useCallback(() => {
        markInstallEngaged();
        markInstallDismissed();
    }, []);

    const showInstallButton = isOsHost && !isInstalled && !installCheckPending;

    return (
        <OsInstallContext.Provider
            value={{
                openInstallModal,
                isInstalled,
                showInstallButton,
            }}
        >
            {children}
            <OsInstallModal
                isOpen={modalOpen}
                onClose={closeModal}
                canPrompt={canPrompt}
                isAlreadyInstalled={isInstalled}
                onInstall={handleInstall}
                onDismiss={handleDismiss}
            />
        </OsInstallContext.Provider>
    );
}
