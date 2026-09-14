'use client';

type TreeEntry = { name: string; path: string; type: 'file' | 'dir'; sha: string };

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  entries: TreeEntry[];
  loading: boolean;
  reason: string | null;
  branch: string | null;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onOpenDir: (path: string) => void;
  breadcrumb: string;
  onGoUp: () => void;
};

export default function IdeFileTree({
  collapsed,
  onToggle,
  entries,
  loading,
  reason,
  branch,
  activePath,
  onOpenFile,
  onOpenDir,
  breadcrumb,
  onGoUp,
}: Props) {
  if (collapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center border-r border-border bg-background-card py-2">
        <button
          type="button"
          onClick={onToggle}
          className="rounded border border-border px-1 py-1 text-xs text-text-secondary"
          title="Expand file tree"
        >
          »
        </button>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-background-card">
      <div className="flex items-center justify-between border-b border-border px-2 py-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-text-primary">Files</div>
          <div className="truncate text-[10px] text-text-secondary">{branch ? `branch ${branch}` : 'unlinked'}</div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded border border-border px-1.5 py-0.5 text-xs text-text-secondary"
          title="Collapse file tree"
        >
          «
        </button>
      </div>
      <div className="flex items-center gap-1 border-b border-border px-2 py-1 text-[11px] text-text-secondary">
        <button type="button" className="underline disabled:no-underline disabled:opacity-40" onClick={onGoUp} disabled={!breadcrumb}>
          ..
        </button>
        <span className="truncate">{breadcrumb || '/'}</span>
      </div>
      <div className="flex-1 overflow-auto p-1 text-sm">
        {loading ? <p className="p-2 text-xs text-text-secondary">Loading…</p> : null}
        {!loading && reason ? <p className="p-2 text-xs text-text-secondary">{reason}</p> : null}
        {!loading && !reason && entries.length === 0 ? (
          <p className="p-2 text-xs text-text-secondary">Empty directory.</p>
        ) : null}
        {entries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left hover:bg-background ${
              activePath === entry.path ? 'bg-background text-text-primary' : 'text-text-secondary'
            }`}
            onClick={() => (entry.type === 'dir' ? onOpenDir(entry.path) : onOpenFile(entry.path))}
          >
            <span className="text-[10px] uppercase text-text-secondary">{entry.type === 'dir' ? 'dir' : 'file'}</span>
            <span className="truncate">{entry.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
