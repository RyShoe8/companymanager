'use client';

type TreeEntry = { name: string; path: string; type: 'file' | 'dir'; sha: string };

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  rootEntries: TreeEntry[];
  childrenByPath: Record<string, TreeEntry[]>;
  expandedPaths: Record<string, boolean>;
  loadingPaths: Record<string, boolean>;
  loading: boolean;
  reason: string | null;
  branch: string | null;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onToggleDir: (path: string) => void;
};

function TreeRows({
  entries,
  depth,
  childrenByPath,
  expandedPaths,
  loadingPaths,
  activePath,
  onOpenFile,
  onToggleDir,
}: {
  entries: TreeEntry[];
  depth: number;
  childrenByPath: Record<string, TreeEntry[]>;
  expandedPaths: Record<string, boolean>;
  loadingPaths: Record<string, boolean>;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onToggleDir: (path: string) => void;
}) {
  return (
    <>
      {entries.map((entry) => {
        const expanded = Boolean(expandedPaths[entry.path]);
        const loading = Boolean(loadingPaths[entry.path]);
        const children = childrenByPath[entry.path];
        return (
          <div key={entry.path}>
            <button
              type="button"
              className={`flex w-full items-center gap-1 rounded py-1 pr-2 text-left hover:bg-background ${
                activePath === entry.path ? 'bg-background text-text-primary' : 'text-text-secondary'
              }`}
              style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
              onClick={() => (entry.type === 'dir' ? onToggleDir(entry.path) : onOpenFile(entry.path))}
            >
              {entry.type === 'dir' ? (
                <span className="w-3 shrink-0 text-[10px] text-text-muted" aria-hidden>
                  {expanded ? '▾' : '▸'}
                </span>
              ) : (
                <span className="w-3 shrink-0" aria-hidden />
              )}
              <span className="truncate text-sm">{entry.name}</span>
            </button>
            {entry.type === 'dir' && expanded ? (
              loading && !children ? (
                <p
                  className="py-1 text-[11px] text-text-muted"
                  style={{ paddingLeft: `${1.25 + depth * 0.75}rem` }}
                >
                  Loading…
                </p>
              ) : children && children.length > 0 ? (
                <TreeRows
                  entries={children}
                  depth={depth + 1}
                  childrenByPath={childrenByPath}
                  expandedPaths={expandedPaths}
                  loadingPaths={loadingPaths}
                  activePath={activePath}
                  onOpenFile={onOpenFile}
                  onToggleDir={onToggleDir}
                />
              ) : children ? (
                <p
                  className="py-1 text-[11px] text-text-muted"
                  style={{ paddingLeft: `${1.25 + depth * 0.75}rem` }}
                >
                  Empty
                </p>
              ) : null
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export default function IdeFileTree({
  collapsed,
  onToggle,
  rootEntries,
  childrenByPath,
  expandedPaths,
  loadingPaths,
  loading,
  reason,
  branch,
  activePath,
  onOpenFile,
  onToggleDir,
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
      <div className="flex-1 overflow-auto p-1 text-sm">
        {loading ? <p className="p-2 text-xs text-text-secondary">Loading…</p> : null}
        {!loading && reason ? <p className="p-2 text-xs text-text-secondary">{reason}</p> : null}
        {!loading && !reason && rootEntries.length === 0 ? (
          <p className="p-2 text-xs text-text-secondary">Empty repository.</p>
        ) : null}
        {!loading && !reason ? (
          <TreeRows
            entries={rootEntries}
            depth={0}
            childrenByPath={childrenByPath}
            expandedPaths={expandedPaths}
            loadingPaths={loadingPaths}
            activePath={activePath}
            onOpenFile={onOpenFile}
            onToggleDir={onToggleDir}
          />
        ) : null}
      </div>
    </aside>
  );
}
