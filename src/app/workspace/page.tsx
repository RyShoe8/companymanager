'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import WorkspaceShell from '@/components/workspace/WorkspaceShell';
import { PhaseType, LensType } from '@/lib/hooks/useWorkspaceData';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';

const VALID_LENSES: LensType[] = ['schedule', 'agenda', 'projects', 'clients', 'capacity'];

function resolveLens(raw: string | null): LensType {
    const lens = (raw as LensType) || 'schedule';
    if (!VALID_LENSES.includes(lens)) return 'schedule';
    if (lens === 'projects') return 'schedule';
    if (lens === 'agenda' && !isFeatureEnabled('agendaViewEnabled')) return 'schedule';
    return lens;
}

function WorkspaceContent() {
    const searchParams = useSearchParams();
    const phase = (searchParams.get('phase') as PhaseType) || 'All';
    const lens = resolveLens(searchParams.get('lens'));
    const initialDeepLinkProjectId = searchParams.get('project');
    const initialDeepLinkTaskId = searchParams.get('task');
    const initialDeepLinkContentId = searchParams.get('content');
    const initialDeepLinkClientId = searchParams.get('client');

    return (
        <WorkspaceShell
            initialPhase={phase}
            initialLens={lens}
            initialDeepLinkProjectId={initialDeepLinkProjectId}
            initialDeepLinkTaskId={initialDeepLinkTaskId}
            initialDeepLinkContentId={initialDeepLinkContentId}
            initialDeepLinkClientId={initialDeepLinkClientId}
        />
    );
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
