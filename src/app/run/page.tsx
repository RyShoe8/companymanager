'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';
import WorkspaceShell from '@/components/workspace/WorkspaceShell';

export default function RunPage() {
  const router = useRouter();

  useEffect(() => {
    if (isFeatureEnabled('workspaceShellEnabled')) {
      router.replace('/workspace?phase=Run');
    }
  }, [router]);

  if (isFeatureEnabled('workspaceShellEnabled')) {
    return <WorkspaceShell initialPhase="Run" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-text-secondary">Redirecting...</div>
    </div>
  );
}
