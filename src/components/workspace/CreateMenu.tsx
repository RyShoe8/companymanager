'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import ActionMenu from '@/components/ui/ActionMenu';

interface CreateMenuProps {
    isManagerOrAdmin: boolean;
    currentUserRole?: string;
    canCreateTaskOrContent: boolean;
    onCreateProject: () => void;
    onCreateTask: () => void;
    onCreateContent: () => void;
    onCreateMeeting: () => void;
    onCreateScreenshot: () => void;
    onCreateRecord: () => void;
    menuOpen?: boolean;
    onMenuOpenChange?: (open: boolean) => void;
}

export default function CreateMenu({
    isManagerOrAdmin,
    currentUserRole,
    canCreateTaskOrContent,
    onCreateProject,
    onCreateTask,
    onCreateContent,
    onCreateMeeting,
    onCreateScreenshot,
    onCreateRecord,
    menuOpen,
    onMenuOpenChange,
}: CreateMenuProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = menuOpen !== undefined;
    const isOpen = isControlled ? menuOpen : internalOpen;

    const setOpen = (next: boolean) => {
        if (!isControlled) setInternalOpen(next);
        onMenuOpenChange?.(next);
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                if (
                    document.activeElement?.tagName === 'INPUT' ||
                    document.activeElement?.tagName === 'TEXTAREA' ||
                    (document.activeElement as HTMLElement)?.isContentEditable
                ) {
                    return;
                }
                e.preventDefault();
                setOpen(!isOpen);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen]);

    const items = [
        ...(isManagerOrAdmin ? [{ label: 'Project', onClick: onCreateProject }] : []),
        ...(canCreateTaskOrContent ? [{ label: 'Task', onClick: onCreateTask }] : []),
        ...(canCreateTaskOrContent ? [{ label: 'Content', onClick: onCreateContent }] : []),
        { label: 'Meeting', onClick: onCreateMeeting },
        { label: 'Screenshot', onClick: onCreateScreenshot },
        { label: 'Recording', onClick: onCreateRecord },
        ...(currentUserRole === 'Administrator'
            ? [{ label: 'Employee (Coming Soon)', disabled: true }]
            : []),
    ];

    return (
        <div data-tour="create-menu">
        <ActionMenu
            isOpen={isOpen}
            onOpenChange={setOpen}
            items={items}
            align="right"
            trigger={({ toggle }) => (
                <Button onClick={toggle} className="flex items-center gap-2">
                    <span>+ Create</span>
                    <svg
                        className={`w-4 h-4 transition-transform duration-200 ease-out ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </Button>
            )}
        />
        </div>
    );
}
