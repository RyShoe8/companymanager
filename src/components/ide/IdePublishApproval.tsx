'use client';

import { useState } from 'react';

type Props = {
  projectId: string | null;
  canPublish: boolean;
  path: string | null;
  originalContent: string;
  content: string;
  expectedSha?: string | null;
  dirty: boolean;
  onPublished: () => void;
};

export default function IdePublishApproval({
  projectId,
  canPublish,
  path,
  originalContent,
  content,
  expectedSha,
  dirty,
  onPublished,
}: Props) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const changed = Boolean(path && dirty && content !== originalContent);

  async function approve() {
    if (!projectId || !path || !changed) return;
    setBusy(true);
    setResult('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/ide/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          message: message.trim() || `Update ${path}`,
          files: [{ path, content, ...(expectedSha ? { expectedSha } : {}) }],
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Publish failed.');
      if (body.status === 'pushed') {
        setResult(`Pushed ${body.commitSha.slice(0, 7)} to ${body.branch}`);
        setConfirmOpen(false);
        setMessage('');
        onPublished();
      } else {
        setResult(body.reason ?? 'Publish blocked.');
      }
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Publish failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!changed) {
    return result ? <p className="px-3 py-1 text-xs text-text-secondary">{result}</p> : null;
  }

  return (
    <div className="border-t border-border bg-background-card px-3 py-2">
      {!confirmOpen ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-secondary">Local edits to {path}</span>
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
            disabled={!canPublish}
            onClick={() => setConfirmOpen(true)}
            title={canPublish ? undefined : 'Managers can commit and push after review.'}
          >
            Review &amp; push to default branch
          </button>
          {!canPublish ? (
            <span className="text-[11px] text-text-secondary">Manager approval required to push.</span>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-text-secondary">
            One approval commits and pushes to the repository default branch (usually main). This is not a PR —
            it lands on the bound branch after you confirm.
          </p>
          <pre className="max-h-40 overflow-auto rounded border border-border bg-background p-2 text-[11px] text-text-secondary whitespace-pre-wrap">
            {`--- a/${path}\n+++ b/${path}\n${summarizeDiff(originalContent, content)}`}
          </pre>
          <input
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
            placeholder="Commit message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={busy}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={busy || !canPublish}
              onClick={() => void approve()}
            >
              {busy ? 'Pushing…' : 'Approve commit & push'}
            </button>
            <button
              type="button"
              className="rounded border border-border px-3 py-1.5 text-sm"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {result ? <p className="mt-1 text-xs text-text-secondary">{result}</p> : null}
    </div>
  );
}

function summarizeDiff(before: string, after: string): string {
  if (before === after) return '(no changes)';
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const max = Math.min(80, Math.max(beforeLines.length, afterLines.length));
  const lines: string[] = [];
  for (let i = 0; i < max; i += 1) {
    const a = beforeLines[i];
    const b = afterLines[i];
    if (a === b) continue;
    if (a != null && b == null) lines.push(`- ${a}`);
    else if (a == null && b != null) lines.push(`+ ${b}`);
    else {
      lines.push(`- ${a}`);
      lines.push(`+ ${b}`);
    }
    if (lines.length >= 60) {
      lines.push('…');
      break;
    }
  }
  return lines.length ? lines.join('\n') : '(content changed)';
}
