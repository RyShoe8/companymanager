'use client';

import { useState, useRef, useEffect } from 'react';
import Button from '@/components/ui/Button';

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
    const menuRef = useRef<HTMLDivElement>(null);

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
                setIsOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const itemClass =
        'w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-muted transition-colors';

    return (
        <div className="relative" ref={menuRef}>
            <Button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2">
                <span>+ Create</span>
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </Button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-background-card border border-border z-50">
                    <div className="py-1" role="menu">
                        {isManagerOrAdmin && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onCreateProject();
                                }}
                                className={itemClass}
                                role="menuitem"
                            >
                                New Project
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onCreateContent();
                            }}
                            className={itemClass}
                            role="menuitem"
                        >
                            New Content Item
                        </button>
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onCreateMeeting();
                            }}
                            className={itemClass}
                            role="menuitem"
                        >
                            New Meeting
                        </button>
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onCreateImage();
                            }}
                            className={itemClass}
                            role="menuitem"
                        >
                            Image
                        </button>
                        <button disabled className="w-full text-left px-4 py-2 text-sm text-text-muted cursor-not-allowed" role="menuitem">
                            New Task (Coming Soon)
                        </button>
                        {currentUserRole === 'Administrator' && (
                            <button disabled className="w-full text-left px-4 py-2 text-sm text-text-muted cursor-not-allowed" role="menuitem">
                                New Employee (Coming Soon)
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
