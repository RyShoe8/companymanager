'use client';

import { SelectHTMLAttributes } from 'react';

export const WORKSPACE_HEADER_SELECT_CLASS =
  'min-h-[2.25rem] rounded border border-border bg-background-card text-text-primary px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

interface WorkspaceFilterSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export default function WorkspaceFilterSelect({
  className = '',
  children,
  ...props
}: WorkspaceFilterSelectProps) {
  return (
    <select
      className={`${WORKSPACE_HEADER_SELECT_CLASS} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
