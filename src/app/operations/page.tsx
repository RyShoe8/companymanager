'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';
import WorkspaceShell from '@/components/workspace/WorkspaceShell';

export default function OperationsPage() {
  const router = useRouter();

  useEffect(() => {
    if (isFeatureEnabled('workspaceShellEnabled')) {
      router.replace('/workspace?lens=schedule');
    }
  }, [router]);

  if (isFeatureEnabled('workspaceShellEnabled')) {
    return <WorkspaceShell initialLens="schedule" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-text-secondary">Redirecting...</div>
    </div>
  );
}
