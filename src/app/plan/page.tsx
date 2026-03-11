'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';
import WorkspaceShell from '@/components/workspace/WorkspaceShell';

export default function PlanPage() {
  const router = useRouter();

  useEffect(() => {
    if (isFeatureEnabled('workspaceShellEnabled')) {
      router.replace('/workspace?phase=Plan');
    }
  }, [router]);

  if (isFeatureEnabled('workspaceShellEnabled')) {
    // Show workspace inline while redirect happens
    return <WorkspaceShell initialPhase="Plan" />;
  }

  // Fallback: original page would render here if flag is off
  // For now, redirect always happens
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-text-secondary">Redirecting...</div>
    </div>
  );
}
