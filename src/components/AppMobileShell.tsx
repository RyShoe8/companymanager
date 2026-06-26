'use client';

import { type ReactNode } from 'react';
import { MobileShellProvider } from '@/contexts/MobileShellContext';
import MobileBottomNav from '@/components/ui/MobileBottomNav';

export default function AppMobileShell({ children }: { children: ReactNode }) {
  return (
    <MobileShellProvider>
      {children}
      <MobileBottomNav />
    </MobileShellProvider>
  );
}
