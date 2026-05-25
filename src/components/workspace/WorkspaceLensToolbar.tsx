'use client';

import { ReactNode } from 'react';

interface WorkspaceLensToolbarProps {
  children: ReactNode;
  className?: string;
}

export default function WorkspaceLensToolbar({ children, className = '' }: WorkspaceLensToolbarProps) {
  return <div className={`flex flex-wrap items-center gap-4 ${className}`.trim()}>{children}</div>;
}
