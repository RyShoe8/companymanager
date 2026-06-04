'use client';

import type { ReactNode } from 'react';

interface CommentsCollapsibleSectionProps {
  expanded: boolean;
  onToggle: () => void;
  count?: number;
  hasUnread?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function CommentsCollapsibleSection({
  expanded,
  onToggle,
  count = 0,
  hasUnread = false,
  className = 'text-xs text-blue-600 hover:underline flex items-center gap-1',
  children,
}: CommentsCollapsibleSectionProps) {
  const countLabel = count > 0 ? ` (${count})` : '';

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          className={`${className}${hasUnread ? ' font-semibold' : ''}`}
        >
          <span className="text-xs">{expanded ? '▼' : '▶'}</span>
          Comments{countLabel}
        </button>
      </div>
      {expanded && children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
