'use client';

import { useState, useRef, useEffect } from 'react';
import Button from '@/components/ui/Button';

interface CreateMenuProps {
    isManagerOrAdmin: boolean;
    currentUserRole?: string;
    onCreateProject: () => void;
    onCreateContent: () => void;
    onCreateMeeting: () => void;
}

export default function CreateMenu({
    isManagerOrAdmin,
    currentUserRole,
    onCreateProject,
    onCreateContent,
    onCreateMeeting,
}: CreateMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Global shortcut 'c' to open menu (only if not typing in an input)
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
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-50 dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1" role="menu">
                        {isManagerOrAdmin && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onCreateProject();
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                role="menuitem"
                            >
                                📁 New Project
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onCreateContent();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            role="menuitem"
                        >
                            📝 New Content Item
                        </button>
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onCreateMeeting();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            role="menuitem"
                        >
                            📅 New Meeting
                        </button>
                        <button disabled className="w-full text-left px-4 py-2 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed" role="menuitem">
                            ✓ New Task (Coming Soon)
                        </button>
                        {currentUserRole === 'Administrator' && (
                            <button disabled className="w-full text-left px-4 py-2 text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed" role="menuitem">
                                👤 New Employee (Coming Soon)
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
