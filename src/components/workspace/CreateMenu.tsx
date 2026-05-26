'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import ActionMenu from '@/components/ui/ActionMenu';

interface CreateMenuProps {
    isManagerOrAdmin: boolean;
    currentUserRole?: string;
    onCreateProject: () => void;
    onCreateContent: () => void;
    onCreateMeeting: () => void;
    onCreateImage: () => void;
}

export default function CreateMenu({
    isManagerOrAdmin,
    currentUserRole,
    onCreateProject,
    onCreateContent,
    onCreateMeeting,
    onCreateImage,
}: CreateMenuProps) {
    const [isOpen, setIsOpen] = useState(false);

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
                setIsOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const items = [
        ...(isManagerOrAdmin ? [{ label: 'New Project', onClick: onCreateProject }] : []),
        { label: 'New Content Item', onClick: onCreateContent },
        { label: 'New Meeting', onClick: onCreateMeeting },
        { label: 'Image', onClick: onCreateImage },
        { label: 'New Task (Coming Soon)', disabled: true },
        ...(currentUserRole === 'Administrator'
            ? [{ label: 'New Employee (Coming Soon)', disabled: true }]
            : []),
    ];

    return (
        <ActionMenu
            isOpen={isOpen}
            onOpenChange={setIsOpen}
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
    );
}
