'use client';

type Props = {
  path: string | null;
  content: string;
  dirty: boolean;
  readOnlyReason: string | null;
  onChange: (value: string) => void;
};

export default function IdeEditor({ path, content, dirty, readOnlyReason, onChange }: Props) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm">
        <div className="truncate text-text-primary">{path ?? 'No file open'}</div>
        <div className="text-xs text-text-secondary">
          {readOnlyReason ? readOnlyReason : dirty ? 'Unsaved local edits' : path ? 'Synced from GitHub' : ''}
        </div>
      </div>
      {path ? (
        <textarea
          className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-xs leading-relaxed text-text-primary outline-none"
          value={content}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-text-secondary">
          Open a file from the tree, or link a repository to get started.
        </div>
      )}
    </section>
  );
}
