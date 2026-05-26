'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';

interface CreateMenuProps {
    isManagerOrAdmin: boolean;
    currentUserRole?: string;
    onCreateProject: () => void;
    onCreateContent: () => void;
    onCreateMeeting: () => void;
    onCreateImage: () => void;
}

type MenuHighlight = { top: number; height: number };

export default function CreateMenu({
    isManagerOrAdmin,
    currentUserRole,
    onCreateProject,
    onCreateContent,
    onCreateMeeting,
    onCreateImage,
}: CreateMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlight, setHighlight] = useState<MenuHighlight | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuListRef = useRef<HTMLDivElement>(null);

    const clearHighlight = useCallback(() => setHighlight(null), []);

    const updateHighlightFromButton = useCallback((button: HTMLButtonElement) => {
        if (button.disabled) {
            clearHighlight();
            return;
        }
        const list = menuListRef.current;
        if (!list) return;
        const listRect = list.getBoundingClientRect();
        const btnRect = button.getBoundingClientRect();
        setHighlight({
            top: btnRect.top - listRect.top,
            height: btnRect.height,
        });
    }, [clearHighlight]);

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
                clearHighlight();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, clearHighlight]);

    useEffect(() => {
        if (!isOpen) clearHighlight();
    }, [isOpen, clearHighlight]);

    const itemClass =
        'relative z-10 w-full text-left px-4 py-2.5 text-sm text-text-primary transition-colors duration-150 ease-out';

    const runAction = (action: () => void) => {
        setIsOpen(false);
        clearHighlight();
        action();
    };

    return (
        <div className="relative" ref={menuRef}>
            <Button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2">
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

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-background-card border border-border z-50 overflow-hidden">
                    <div
                        ref={menuListRef}
                        className="relative py-1"
                        role="menu"
                        onMouseLeave={clearHighlight}
                    >
                        <div
                            aria-hidden
                            className="absolute left-1.5 right-1.5 rounded-md pointer-events-none bg-primary/20 shadow-[inset_0_0_0_1px_rgba(0,194,224,0.35)] transition-[top,height,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                            style={{
                                top: highlight?.top ?? 0,
                                height: highlight?.height ?? 0,
                                opacity: highlight ? 1 : 0,
                            }}
                        />
                        {isManagerOrAdmin && (
                            <button
                                onClick={() => runAction(onCreateProject)}
                                onMouseEnter={(e) => updateHighlightFromButton(e.currentTarget)}
                                className={`${itemClass} hover:text-primary`}
                                role="menuitem"
                            >
                                New Project
                            </button>
                        )}
                        <button
                            onClick={() => runAction(onCreateContent)}
                            onMouseEnter={(e) => updateHighlightFromButton(e.currentTarget)}
                            className={`${itemClass} hover:text-primary`}
                            role="menuitem"
                        >
                            New Content Item
                        </button>
                        <button
                            onClick={() => runAction(onCreateMeeting)}
                            onMouseEnter={(e) => updateHighlightFromButton(e.currentTarget)}
                            className={`${itemClass} hover:text-primary`}
                            role="menuitem"
                        >
                            New Meeting
                        </button>
                        <button
                            onClick={() => runAction(onCreateImage)}
                            onMouseEnter={(e) => updateHighlightFromButton(e.currentTarget)}
                            className={`${itemClass} hover:text-primary`}
                            role="menuitem"
                        >
                            Image
                        </button>
                        <button
                            disabled
                            onMouseEnter={clearHighlight}
                            className="relative z-10 w-full text-left px-4 py-2.5 text-sm text-text-muted cursor-not-allowed"
                            role="menuitem"
                        >
                            New Task (Coming Soon)
                        </button>
                        {currentUserRole === 'Administrator' && (
                            <button
                                disabled
                                onMouseEnter={clearHighlight}
                                className="relative z-10 w-full text-left px-4 py-2.5 text-sm text-text-muted cursor-not-allowed"
                                role="menuitem"
                            >
                                New Employee (Coming Soon)
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
