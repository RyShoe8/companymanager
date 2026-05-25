'use client';

import { ReactNode } from 'react';

interface WorkspaceLensToolbarProps {
  children: ReactNode;
}

export default function WorkspaceLensToolbar({ children }: WorkspaceLensToolbarProps) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>;
}
