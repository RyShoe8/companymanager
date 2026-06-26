'use client';

import { type ReactNode } from 'react';
import { MobileShellProvider } from '@/contexts/MobileShellContext';
import MobileBottomNav from '@/components/ui/MobileBottomNav';

export default function AppMobileShell({ children }: { children: ReactNode }) {
  return (
    <MobileShellProvider>
      <div className="flex flex-1 flex-col min-h-0 w-full">
        {children}
      </div>
      <MobileBottomNav />
    </MobileShellProvider>
  );
}
