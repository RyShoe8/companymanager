'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import CommandRegistry, { Command } from '@/lib/commands/CommandRegistry';
import { useIntentConfirmation } from '@/components/intent/IntentConfirmationContext';
import type { WorkspaceIntentContextPayload } from '@/lib/voice/workspaceIntentContext';
import { parseIntentWithContext } from '@/lib/voice/parseIntentApi';
import { parseIntent } from '@/lib/voice/IntentParser';
import { enrichIntentWithContext } from '@/lib/voice/enrichIntentWithContext';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceIntentContext: WorkspaceIntentContextPayload;
    nlError: string | null;
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

type PaletteMode = 'commands' | 'ask';

export default function CommandPalette({
    isOpen,
    onClose,
    workspaceIntentContext,
    nlError,
}: CommandPaletteProps) {
    const intentCtx = useIntentConfirmation();
    const [mode, setMode] = useState<PaletteMode>('commands');
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [commands, setCommands] = useState<Command[]>([]);
    const [askBusy, setAskBusy] = useState(false);
    const [askParseError, setAskParseError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateCommands = () => {
            setCommands(CommandRegistry.search(query));
        };
        updateCommands();
        const unsub = CommandRegistry.subscribe(updateCommands);
        return unsub;
    }, [query]);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setMode('commands');
            setAskParseError(null);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [commands]);

    const runNaturalLanguage = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return;
            setAskBusy(true);
            setAskParseError(null);
            try {
                const llm = await parseIntentWithContext(trimmed, workspaceIntentContext);

                let intent = llm.ok ? llm.intent : null;
                let parseSource: 'llm' | 'rules' = 'llm';

                if (!llm.ok) {
                    if (llm.status !== 503) {
                        setAskParseError(llm.error || 'Could not reach intent parser');
                        return;
                    }
                    intent = parseIntent(trimmed);
                    intent = enrichIntentWithContext(intent, workspaceIntentContext);
                    parseSource = 'rules';
                } else if (!intent) {
                    intent = parseIntent(trimmed);
                    intent = enrichIntentWithContext(intent, workspaceIntentContext);
                    parseSource = 'rules';
                }

                if (!intent || intent.type === 'UNKNOWN') {
                    setAskParseError(`Couldn't understand: "${trimmed}"`);
                    return;
                }

                intentCtx.presentConfirmation({
                    sourceText: trimmed,
                    intent,
                    parseSource,
                    origin: 'palette',
                    contextSnapshot: workspaceIntentContext,
                });
                onClose();
            } finally {
                setAskBusy(false);
            }
        },
        [workspaceIntentContext, intentCtx, onClose]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (mode === 'ask') return;

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
                    if (e.shiftKey && query.trim()) {
                        e.preventDefault();
                        void runNaturalLanguage(query);
                        return;
                    }
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
        [commands, selectedIndex, onClose, mode, query, runNaturalLanguage]
    );

    const handleAskKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                void runNaturalLanguage(query);
            }
        },
        [query, runNaturalLanguage, onClose]
    );

    useEffect(() => {
        const listEl = listRef.current;
        if (!listEl || mode !== 'commands') return;
        const selected = listEl.children[selectedIndex] as HTMLElement;
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex, mode]);

    if (!isOpen) return null;

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
            <div className="fixed inset-0 bg-black/60 z-[105]" onClick={onClose} aria-hidden="true" />

            <div
                className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[105]"
                role="dialog"
                aria-modal="true"
                aria-label="Command palette"
            >
                <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="flex border-b border-gray-700">
                        <button
                            type="button"
                            className={`flex-1 py-2.5 text-sm font-medium ${mode === 'commands' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => setMode('commands')}
                        >
                            Commands
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-2.5 text-sm font-medium ${mode === 'ask' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => setMode('ask')}
                        >
                            Ask
                        </button>
                    </div>

                    {(nlError || askParseError) && (
                        <div className="px-4 py-2 bg-red-950/80 border-b border-red-900 text-red-200 text-sm">
                            {askParseError || nlError}
                        </div>
                    )}

                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder={mode === 'ask' ? 'What do you want to do?' : 'Type a command...'}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={mode === 'commands' ? handleKeyDown : handleAskKeyDown}
                            disabled={askBusy}
                            className="w-full bg-transparent text-white placeholder-gray-500 text-lg focus:outline-none disabled:opacity-50"
                        />
                        <kbd className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700 shrink-0">
                            ESC
                        </kbd>
                    </div>

                    {mode === 'ask' && !query.trim() && (
                        <div className="px-4 py-3 text-sm text-gray-500 border-b border-gray-700 space-y-1">
                            <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Examples</p>
                            <p>&ldquo;Create task review docs for next week&rdquo;</p>
                            <p>&ldquo;Add LinkedIn post announcing the launch tomorrow&rdquo;</p>
                            <p>&ldquo;Go to calendar view&rdquo;</p>
                        </div>
                    )}

                    {mode === 'commands' && (
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
                                                    type="button"
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
                    )}

                    {mode === 'ask' && (
                        <div className="px-4 py-6 text-center text-gray-500 text-sm">
                            {askBusy ? (
                                <span className="text-yellow-400">Parsing…</span>
                            ) : (
                                <span>Press Enter to parse with AI (same flow as voice: confirm, then run).</span>
                            )}
                        </div>
                    )}

                    <div className="px-4 py-2 border-t border-gray-700 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        {mode === 'commands' ? (
                            <>
                                <span>↑↓ Navigate</span>
                                <span>↵ Run command</span>
                                <span>⇧↵ AI command</span>
                            </>
                        ) : (
                            <span>↵ Parse intent</span>
                        )}
                        <span>Esc Close</span>
                    </div>
                </div>
            </div>
        </>
    );
}
