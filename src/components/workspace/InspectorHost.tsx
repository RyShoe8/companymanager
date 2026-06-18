'use client';

import { useMemo, useRef, useCallback, type RefObject } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import InlineProjectView from '@/components/planning-map/InlineProjectView';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem } from '@/lib/models/ContentItem';
import type { TimeframeType } from '@/lib/utils/dateUtils';
import { projectSaveErrorMessage } from '@/lib/utils/projectSaveError';
import { InspectorLightProvider } from '@/contexts/InspectorLightContext';

export type FocusType = 'project' | 'task';

interface InspectorHostProps {
    focusId: string | null;
    onClose: () => void;
    projects: IProject[];
    employees: IEmployee[];
    isManagerOrAdmin: boolean;
    currentUserEmployeeId?: string;
    onRefresh: () => void;
    onProjectPatched?: (project: IProject) => void;
    initialOpenTaskIndex?: number | null;
    onInitialOpenTaskConsumed?: () => void;
    initialOpenContentId?: string | null;
    onInitialOpenContentConsumed?: () => void;
    scrollContainerRef?: RefObject<HTMLDivElement | null>;
    autoAddTaskOnOpen?: boolean;
    onAutoAddTaskConsumed?: () => void;
    onAddContent?: (project: IProject) => void;
    onContentItemClick?: (item: IContentItem) => void;
    contentRefreshTrigger?: number;
    onContentListChanged?: () => void;
    timeframe?: TimeframeType;
    referenceDate?: Date;
}

export default function InspectorHost({
    focusId,
    onClose,
    projects,
    employees,
    isManagerOrAdmin,
    currentUserEmployeeId,
    onRefresh,
    onProjectPatched,
    initialOpenTaskIndex,
    onInitialOpenTaskConsumed,
    initialOpenContentId,
    onInitialOpenContentConsumed,
    scrollContainerRef: scrollContainerRefProp,
    autoAddTaskOnOpen,
    onAutoAddTaskConsumed,
    onAddContent,
    onContentItemClick,
    contentRefreshTrigger,
    onContentListChanged,
    timeframe = 'weekly',
    referenceDate,
}: InspectorHostProps) {
    const internalScrollRef = useRef<HTMLDivElement | null>(null);
    const scrollContainerRef = scrollContainerRefProp ?? internalScrollRef;

    const { type, id } = useMemo(() => {
        if (!focusId) return { type: null, id: null };
        const parts = focusId.split(':');
        return { type: parts[0] as FocusType, id: parts[1] };
    }, [focusId]);

    const focusedProject = useMemo(() => {
        if (type === 'project' && id) {
            return projects.find((p) => p._id.toString() === id);
        }
        return null;
    }, [type, id, projects]);

    const focusedProjectId = focusedProject?._id.toString() ?? null;

    const handleProjectUpdate = useCallback(
        async (updates: Partial<IProject> & { allowBulkTaskExpand?: boolean }) => {
            if (!focusedProjectId || !updates || Object.keys(updates).length === 0) return;
            const res = await fetch(`/api/projects/${focusedProjectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) {
                throw new Error(await projectSaveErrorMessage(res));
            }
            const data = await res.json().catch(() => null);
            if (data && typeof data === 'object' && data._id) {
                if (onProjectPatched) {
                    onProjectPatched(data as IProject);
                }
                return data as IProject;
            }
            onRefresh();
        },
        [focusedProjectId, onProjectPatched, onRefresh]
    );

    const handleProjectDelete = useCallback(async () => {
        if (!focusedProjectId) return;
        const res = await fetch(`/api/projects/${focusedProjectId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete project');
        onRefresh();
        onClose();
    }, [focusedProjectId, onRefresh, onClose]);

    const renderInnerContent = () => {
        if (type === 'project' && focusedProject) {
            return (
                <div className="inspector-light w-full max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border border-border rounded-t-2xl bg-white" data-tour="project-inspector">
                    <InspectorLightProvider>
                    <InlineProjectView
                        project={focusedProject}
                        employees={employees}
                        isManagerOrAdmin={isManagerOrAdmin}
                        currentUserEmployeeId={currentUserEmployeeId}
                        onAddContent={onAddContent}
                        onContentItemClick={onContentItemClick}
                        contentRefreshTrigger={contentRefreshTrigger}
                        onContentListChanged={onContentListChanged}
                        initialOpenTaskIndex={initialOpenTaskIndex ?? null}
                        onInitialOpenTaskConsumed={onInitialOpenTaskConsumed}
                        initialOpenContentId={initialOpenContentId ?? null}
                        onInitialOpenContentConsumed={onInitialOpenContentConsumed}
                        scrollContainerRef={scrollContainerRef}
                        autoAddTaskOnOpen={autoAddTaskOnOpen}
                        onAutoAddTaskConsumed={onAutoAddTaskConsumed}
                        timeframe={timeframe}
                        referenceDate={referenceDate}
                        onProjectPatched={onProjectPatched}
                        onUpdate={handleProjectUpdate}
                        onDelete={handleProjectDelete}
                        onClose={onClose}
                        onRefresh={onRefresh}
                    />
                    </InspectorLightProvider>
                </div>
            );
        }

        if (type === 'task' && id) {
            return (
                <div className="p-6 text-center text-gray-400">
                    <p>Task Editor</p>
                    <p className="text-sm mt-2">ID: {id}</p>
                </div>
            );
        }

        return (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                <svg className="w-12 h-12 mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Select an item to view details</p>
            </div>
        );
    };

    if (!focusId) return null;

    const isProjectInspector = type === 'project';

    return (
        <BottomSheet
            isOpen={!!focusId}
            onClose={onClose}
            title={undefined}
            surface={isProjectInspector ? 'chrome' : 'card'}
            layout={isProjectInspector ? 'centeredInspector' : 'bottomSheet'}
            maxHeight="90vh"
            hideCloseButton
            scrollContainerRef={scrollContainerRef}
        >
            <div className={isProjectInspector ? 'pb-4' : 'pb-8'}>
                {renderInnerContent()}
            </div>
        </BottomSheet>
    );
}
