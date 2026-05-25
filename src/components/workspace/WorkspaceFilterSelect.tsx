'use client';

import { SelectHTMLAttributes } from 'react';

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
      className={`rounded border border-border bg-background-card text-text-primary px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
