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
  width: number;
  onWidthChange: (width: number) => void;
};

const CHAT_MIN_WIDTH = 280;
const CHAT_MAX_WIDTH = 720;

export default function IdeChatPane({
  projectId,
  mode,
  onModeChange,
  onOpenRules,
  width,
  onWidthChange,
}: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resizing, setResizing] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendGenerationRef = useRef(0);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sendGenerationRef.current += 1;
    setBusy(false);
    setTurns([]);
    setError('');
  }, [projectId, mode]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [turns]);

  useEffect(() => {
    if (!resizing) return;

    const clampWidth = (next: number) => {
      const max = Math.min(CHAT_MAX_WIDTH, Math.floor(window.innerWidth * 0.7));
      return Math.min(max, Math.max(CHAT_MIN_WIDTH, next));
    };

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      // Dragging the left edge leftward widens the pane.
      onWidthChange(clampWidth(drag.startWidth + (drag.startX - event.clientX)));
    };

    const finish = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setResizing(false);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [resizing, onWidthChange]);

  function onResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width,
    };
    setResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

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

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = ++sendGenerationRef.current;

    try {
      const history = [...turns, userTurn]
        .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
        .slice(-8)
        .map((turn) => ({ role: turn.role, text: turn.text }));
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/ide/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, text, history }),
        signal: controller.signal,
      });
      if (generation !== sendGenerationRef.current || controller.signal.aborted) return;
      const body = await response.json();
      if (generation !== sendGenerationRef.current || controller.signal.aborted) return;
      if (!response.ok) throw new Error(body.error ?? 'Chat request failed.');
      const turn = body.turn as ChatTurn;
      setTurns((current) => [...current, turn]);
    } catch (err) {
      if (generation !== sendGenerationRef.current) return;
      if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        setTurns((current) => [
          ...current,
          {
            requestId: crypto.randomUUID(),
            role: 'status',
            text: 'Stopped.',
          },
        ]);
        return;
      }
      setError(err instanceof Error ? err.message : 'Chat request failed.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (generation === sendGenerationRef.current) setBusy(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-background-card"
      style={{ width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat pane"
        aria-valuenow={Math.round(width)}
        aria-valuemin={CHAT_MIN_WIDTH}
        aria-valuemax={CHAT_MAX_WIDTH}
        tabIndex={0}
        className={`absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize touch-none ${
          resizing ? 'bg-primary/50' : 'bg-transparent hover:bg-primary/30'
        }`}
        onPointerDown={onResizePointerDown}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onWidthChange(Math.min(CHAT_MAX_WIDTH, width + 16));
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            onWidthChange(Math.max(CHAT_MIN_WIDTH, width - 16));
          }
        }}
      />
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
        {busy ? (
          <button
            type="button"
            className="w-full rounded border border-border px-3 py-2 text-sm"
            onClick={stop}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="w-full rounded border border-border px-3 py-2 text-sm disabled:opacity-50"
            disabled={!projectId || !draft.trim()}
            onClick={() => void send()}
          >
            Send
          </button>
        )}
      </div>
    </aside>
  );
}
