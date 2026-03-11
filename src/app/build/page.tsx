'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';
import WorkspaceShell from '@/components/workspace/WorkspaceShell';

export default function BuildPage() {
  const router = useRouter();

  useEffect(() => {
    if (isFeatureEnabled('workspaceShellEnabled')) {
      router.replace('/workspace?phase=Build');
    }
  }, [router]);

  if (isFeatureEnabled('workspaceShellEnabled')) {
    return <WorkspaceShell initialPhase="Build" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-text-secondary">Redirecting...</div>
    </div>
  );
}
