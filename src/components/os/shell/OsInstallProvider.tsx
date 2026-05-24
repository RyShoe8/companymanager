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
    hasSeenInstallOnModules,
    isInstallDismissed,
    markSeenInstallOnLoad,
    markSeenInstallOnModules,
    shouldShowInstallPrompt,
} from '@/lib/os/pwaInstall';
import OsInstallModal from './OsInstallModal';

interface OsInstallContextValue {
    /** Open the install modal manually (top bar button). */
    openInstallModal: (onClose?: () => void) => void;
    /** Call when + Modules is clicked; runs onProceed after modal closes if shown. */
    tryModulesClick: (onProceed: () => void) => void;
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
    const { isOsHost, isInstalled, canPrompt, promptInstall, dismiss } = usePwaInstall();
    const [modalOpen, setModalOpen] = useState(false);
    const onCloseRef = useRef<(() => void) | null>(null);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        const cb = onCloseRef.current;
        onCloseRef.current = null;
        cb?.();
    }, []);

    const openInstallModal = useCallback(
        (onClose?: () => void) => {
            if (isInstalled) {
                onClose?.();
                return;
            }
            onCloseRef.current = onClose ?? null;
            setModalOpen(true);
        },
        [isInstalled]
    );

    useEffect(() => {
        if (!isOsHost || isInstalled || isInstallDismissed() || hasSeenInstallOnLoad()) {
            return;
        }
        markSeenInstallOnLoad();
        setModalOpen(true);
    }, [isOsHost, isInstalled]);

    const tryModulesClick = useCallback(
        (onProceed: () => void) => {
            if (!shouldShowInstallPrompt() || hasSeenInstallOnModules()) {
                onProceed();
                return;
            }
            markSeenInstallOnModules();
            openInstallModal(onProceed);
        },
        [openInstallModal]
    );

    const handleInstall = useCallback(async () => {
        if (canPrompt) {
            await promptInstall();
        }
    }, [canPrompt, promptInstall]);

    const handleDismiss = useCallback(() => {
        dismiss();
    }, [dismiss]);

    const showInstallButton = isOsHost && !isInstalled;

    return (
        <OsInstallContext.Provider
            value={{
                openInstallModal,
                tryModulesClick,
                isInstalled,
                showInstallButton,
            }}
        >
            {children}
            <OsInstallModal
                isOpen={modalOpen}
                onClose={closeModal}
                canPrompt={canPrompt}
                onInstall={handleInstall}
                onDismiss={handleDismiss}
            />
        </OsInstallContext.Provider>
    );
}
