'use client';

import { useMemo } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import InlineProjectView from '@/components/planning-map/InlineProjectView';
import ContentItemDetailModal from '@/components/planning-map/ContentItemDetailModal';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem } from '@/lib/models/ContentItem';
import type { TimeframeType } from '@/lib/utils/dateUtils';

export type FocusType = 'project' | 'content' | 'task';

interface InspectorHostProps {
    focusId: string | null;  // e.g., 'project:123' or 'content:456'
    onClose: () => void;
    // context props
    projects: IProject[];
    employees: IEmployee[];
    isManagerOrAdmin: boolean;
    currentUserEmployeeId?: string;
    onRefresh: () => void;
    /** After a successful project PUT, merge API JSON into workspace state (avoids full reload on each save). */
    onProjectPatched?: (project: IProject) => void;
    /** When opening the inspector from a schedule task row, focus this task index in the project view. */
    initialOpenTaskIndex?: number | null;
    onInitialOpenTaskConsumed?: () => void;
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
    autoAddTaskOnOpen,
    onAutoAddTaskConsumed,
    onAddContent,
    onContentItemClick,
    contentRefreshTrigger,
    onContentListChanged,
    timeframe = 'weekly',
    referenceDate,
}: InspectorHostProps) {
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

    // Handle actual content rendering for the inspector
    const renderInnerContent = () => {
        if (type === 'project' && focusedProject) {
            return (
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <InlineProjectView
                        project={focusedProject}
                        employees={employees}
                        isManagerOrAdmin={isManagerOrAdmin}
                        currentUserEmployeeId={currentUserEmployeeId}
                        onAddContent={onAddContent}
                        onContentItemClick={onContentItemClick}
                        contentRefreshTrigger={contentRefreshTrigger}
                        initialOpenTaskIndex={initialOpenTaskIndex ?? null}
                        onInitialOpenTaskConsumed={onInitialOpenTaskConsumed}
                        autoAddTaskOnOpen={autoAddTaskOnOpen}
                        onAutoAddTaskConsumed={onAutoAddTaskConsumed}
                        timeframe={timeframe}
                        referenceDate={referenceDate}
                        onProjectPatched={onProjectPatched}
                        onUpdate={async (updates) => {
                            if (!updates || Object.keys(updates).length === 0) return;
                            const res = await fetch(`/api/projects/${focusedProject._id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(updates),
                            });
                            if (!res.ok) throw new Error('Failed to save project');
                            const data = await res.json().catch(() => null);
                            if (data && typeof data === 'object' && data._id && onProjectPatched) {
                                onProjectPatched(data as IProject);
                            } else {
                                onRefresh();
                            }
                        }}
                        onDelete={async () => {
                            const res = await fetch(`/api/projects/${focusedProject._id}`, { method: 'DELETE' });
                            if (!res.ok) throw new Error('Failed to delete project');
                            onRefresh();
                            onClose();
                        }}
                        onClose={onClose}
                        onRefresh={onRefresh}
                    />
                </div>
            );
        }

        if (type === 'content' && id) {
            return (
                <ContentItemDetailModal
                    isOpen={true}
                    onClose={onClose}
                    contentItemId={id}
                    employees={employees}
                    isManagerOrAdmin={isManagerOrAdmin}
                    onSaved={() => {
                        onRefresh();
                        onContentListChanged?.();
                    }}
                    onDeleted={() => {
                        onRefresh();
                        onContentListChanged?.();
                        onClose();
                    }}
                    isInline={true}
                />
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

    const getTitle = () => {
        if (type === 'project') return focusedProject?.name || 'Project Details';
        if (type === 'content') return 'Content Details';
        if (type === 'task') return 'Task Details';
        return 'Details';
    };

    if (!focusId) return null;

    return (
        <BottomSheet
            isOpen={!!focusId}
            onClose={onClose}
            title={getTitle()}
            maxHeight="90vh"
            hideCloseButton
        >
            <div className="pb-8">
                {renderInnerContent()}
            </div>
        </BottomSheet>
    );
}
