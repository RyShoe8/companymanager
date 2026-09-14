'use client';

import { useEffect, useRef, useState } from 'react';
import { formatIdeCostUsd } from '@/lib/ide/costDisplay';
import { ideChatModes, type IdeChatMode } from '@/lib/ide/modes';

type ChatTurn = {
  requestId: string;
  role: 'user' | 'assistant' | 'status';
  text: string;
  costMicros?: number | null;
  reservedMicros?: number | null;
  noProviderFee?: boolean;
};

type Props = {
  projectId: string | null;
  mode: IdeChatMode;
  onModeChange: (mode: IdeChatMode) => void;
  onOpenRules: () => void;
};

export default function IdeChatPane({ projectId, mode, onModeChange, onOpenRules }: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTurns([]);
    setError('');
  }, [projectId, mode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [turns]);

  async function send() {
    if (!projectId || !draft.trim() || busy) return;
    const text = draft.trim();
    setDraft('');
    setBusy(true);
    setError('');
    const userTurn: ChatTurn = {
      requestId: crypto.randomUUID(),
      role: 'user',
      text,
    };
    setTurns((current) => [...current, userTurn]);
    try {
      const history = [...turns, userTurn]
        .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
        .slice(-8)
        .map((turn) => ({ role: turn.role, text: turn.text }));
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/ide/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, text, history }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Chat request failed.');
      const turn = body.turn as ChatTurn;
      setTurns((current) => [...current, turn]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full w-full max-w-md shrink-0 flex-col border-l border-border bg-background-card md:w-[22rem]">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-2">
        {ideChatModes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onModeChange(item.id)}
            className={`rounded px-2 py-1 text-xs ${
              mode === item.id
                ? 'bg-primary text-white'
                : 'border border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onOpenRules}
          className="ml-auto rounded border border-border px-2 py-1 text-xs text-text-secondary"
        >
          Rules
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-auto p-3 text-sm">
        {turns.length === 0 ? (
          <p className="text-xs text-text-secondary">
            Chat with Plan, Build, Research, or Marketing. Costs show in dollars per reply.
          </p>
        ) : null}
        {turns.map((turn) => {
          const cost =
            turn.role === 'assistant' || turn.role === 'status'
              ? formatIdeCostUsd({
                  costMicros: turn.costMicros ?? null,
                  reservedMicros: turn.reservedMicros ?? null,
                  noProviderFee: turn.noProviderFee ?? false,
                })
              : null;
          return (
            <div
              key={turn.requestId}
              className={`rounded border px-2 py-2 ${
                turn.role === 'user'
                  ? 'border-border bg-background'
                  : turn.role === 'status'
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-border'
              }`}
            >
              <div className="mb-1 text-[10px] uppercase tracking-wide text-text-secondary">{turn.role}</div>
              <div className="whitespace-pre-wrap text-text-primary">{turn.text}</div>
              {cost && cost.amount !== '—' ? (
                <div className="mt-1 text-[11px] text-text-secondary">
                  {cost.label === 'reserved' ? 'Reserved ' : cost.label === 'no provider fee' ? '' : ''}
                  {cost.amount}
                  {cost.label === 'no provider fee' ? ' · no provider fee' : ''}
                  {cost.label === 'reserved' ? ' (usage unknown)' : ''}
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {error ? <p className="px-3 text-xs text-red-500">{error}</p> : null}
      <div className="border-t border-border p-2">
        <textarea
          className="mb-2 h-20 w-full resize-none rounded border border-border bg-background p-2 text-sm text-text-primary"
          placeholder={projectId ? 'Message…' : 'Select a project first'}
          value={draft}
          disabled={!projectId || busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          className="w-full rounded border border-border px-3 py-2 text-sm disabled:opacity-50"
          disabled={!projectId || busy || !draft.trim()}
          onClick={() => void send()}
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </aside>
  );
}
