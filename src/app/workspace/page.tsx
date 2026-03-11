'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import WorkspaceShell from '@/components/workspace/WorkspaceShell';
import { PhaseType, LensType } from '@/lib/hooks/useWorkspaceData';

function WorkspaceContent() {
    const searchParams = useSearchParams();
    const phase = (searchParams.get('phase') as PhaseType) || 'All';
    const lens = (searchParams.get('lens') as LensType) || 'schedule';

    return <WorkspaceShell initialPhase={phase} initialLens={lens} />;
}

export default function WorkspacePage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-text-secondary">Loading workspace...</div>
                </div>
            }
        >
            <WorkspaceContent />
        </Suspense>
    );
}
