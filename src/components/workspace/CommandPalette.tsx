'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import CommandRegistry, { Command } from '@/lib/commands/CommandRegistry';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

const categoryIcons: Record<string, string> = {
    navigate: '🧭',
    create: '➕',
    filter: '🔍',
    open: '📂',
    view: '👁️',
    edit: '✏️',
};

const categoryLabels: Record<string, string> = {
    navigate: 'Navigate',
    create: 'Create',
    filter: 'Filter',
    open: 'Open',
    view: 'View',
    edit: 'Edit',
};

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [commands, setCommands] = useState<Command[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Update commands when registry changes or query changes
    useEffect(() => {
        const updateCommands = () => {
            setCommands(CommandRegistry.search(query));
        };
        updateCommands();
        const unsub = CommandRegistry.subscribe(updateCommands);
        return unsub;
    }, [query]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Reset selected index when commands change
    useEffect(() => {
        setSelectedIndex(0);
    }, [commands]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((i) => Math.min(i + 1, commands.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((i) => Math.max(i - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (commands[selectedIndex]) {
                        commands[selectedIndex].execute();
                        onClose();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        },
        [commands, selectedIndex, onClose]
    );

    // Scroll selected item into view
    useEffect(() => {
        const listEl = listRef.current;
        if (!listEl) return;
        const selected = listEl.children[selectedIndex] as HTMLElement;
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    // Group by category
    const grouped = commands.reduce(
        (acc, cmd) => {
            if (!acc[cmd.category]) acc[cmd.category] = [];
            acc[cmd.category].push(cmd);
            return acc;
        },
        {} as Record<string, Command[]>
    );

    let flatIndex = 0;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 z-50"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Palette */}
            <div
                className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
                role="dialog"
                aria-modal="true"
                aria-label="Command palette"
            >
                <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                    {/* Search input */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Type a command..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-transparent text-white placeholder-gray-500 text-lg focus:outline-none"
                        />
                        <kbd className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
                            ESC
                        </kbd>
                    </div>

                    {/* Results */}
                    <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
                        {commands.length === 0 ? (
                            <div className="px-4 py-8 text-center text-gray-500">
                                No commands match &ldquo;{query}&rdquo;
                            </div>
                        ) : (
                            Object.entries(grouped).map(([category, cmds]) => (
                                <div key={category}>
                                    <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {categoryIcons[category]} {categoryLabels[category] || category}
                                    </div>
                                    {cmds.map((cmd) => {
                                        const idx = flatIndex++;
                                        return (
                                            <button
                                                key={cmd.id}
                                                onClick={() => {
                                                    cmd.execute();
                                                    onClose();
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx === selectedIndex
                                                        ? 'bg-primary/20 text-white'
                                                        : 'text-gray-300 hover:bg-gray-800'
                                                    }`}
                                            >
                                                <span className="text-sm">{cmd.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 border-t border-gray-700 flex items-center gap-4 text-xs text-gray-500">
                        <span>↑↓ Navigate</span>
                        <span>↵ Execute</span>
                        <span>Esc Close</span>
                    </div>
                </div>
            </div>
        </>
    );
}
