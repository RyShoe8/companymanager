'use client';

import { useState, useMemo } from 'react';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { getProjectStatusDisplayLabel, mapStatusToStage } from '@/lib/utils/statusMapping';
import { computeProjectEstimatedHours } from '@/lib/utils/projectHours';
import type { TimeframeType } from '@/lib/utils/dateUtils';
import WorkspaceFilterSelect from '@/components/workspace/WorkspaceFilterSelect';

interface ProjectsLensProps {
    projects: IProject[];
    contentItems?: IContentItem[];
    timeframe?: TimeframeType;
    referenceDate?: Date;
    onProjectClick: (project: IProject) => void;
}

const statusBadgeColors: Record<string, { bg: string; text: string }> = {
    planning: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    'in-development': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    launched: { bg: 'bg-green-500/20', text: 'text-green-400' },
    'in-review': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    completed: { bg: 'bg-muted', text: 'text-text-muted' },
};

const typeBadgeColors: Record<string, string> = {
    website: '#3b82f6',
    store: '#10b981',
    app: '#8b5cf6',
    generic: '#6b7280',
    internal: '#f59e0b',
    client: '#ec4899',
};

export default function ProjectsLens({
    projects,
    contentItems = [],
    timeframe = 'weekly',
    referenceDate,
    onProjectClick,
}: ProjectsLensProps) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'name' | 'updated' | 'status'>('updated');

    const filtered = useMemo(() => {
        let result = [...projects];

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    p.description?.toLowerCase().includes(q)
            );
        }

        if (statusFilter !== 'all') {
            result = result.filter((p) => p.status === statusFilter);
        }

        if (typeFilter !== 'all') {
            result = result.filter((p) => p.projectType === typeFilter);
        }

        result.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'status') return a.status.localeCompare(b.status);
            const aDate = new Date((a as any).updatedAt || a.createdAt).getTime();
            const bDate = new Date((b as any).updatedAt || b.createdAt).getTime();
            return bDate - aDate;
        });

        return result;
    }, [projects, search, statusFilter, typeFilter, sortBy]);

    return (
        <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <input
                    type="text"
                    placeholder="Search projects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-lg border border-border bg-background-card text-text-primary placeholder:text-text-muted px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <WorkspaceFilterSelect
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="py-2"
                >
                    <option value="all">All statuses</option>
                    <option value="planning">Planning</option>
                    <option value="in-development">In Development</option>
                    <option value="launched">Launched</option>
                    <option value="in-review">In Review</option>
                    <option value="completed">Completed</option>
                </WorkspaceFilterSelect>
                <WorkspaceFilterSelect
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="py-2"
                >
                    <option value="all">All types</option>
                    <option value="website">Website</option>
                    <option value="store">Store</option>
                    <option value="app">App</option>
                    <option value="generic">Generic</option>
                    <option value="internal">Internal</option>
                    <option value="client">Client</option>
                </WorkspaceFilterSelect>
                <WorkspaceFilterSelect
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'updated' | 'status')}
                    className="py-2"
                >
                    <option value="updated">Recently updated</option>
                    <option value="name">Name A–Z</option>
                    <option value="status">Status</option>
                </WorkspaceFilterSelect>
                <span className="text-sm text-text-secondary ml-auto">
                    {filtered.length} project{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16 text-text-secondary">
                    <p className="text-lg mb-2 text-text-primary">No projects match your filters</p>
                    <p className="text-sm">Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((project) => {
                        const stage = mapStatusToStage(project.status as any);
                        const colors = statusBadgeColors[project.status] || statusBadgeColors.planning;
                        const taskCount = project.tasks?.length || 0;
                        const completedTasks = project.tasks?.filter((t) => t.status === 'completed').length || 0;
                        const estHours = computeProjectEstimatedHours(project, contentItems);

                        return (
                            <div
                                key={project._id.toString()}
                                onClick={() => onProjectClick(project)}
                                className="bg-background-card border border-border rounded-lg p-4 cursor-pointer hover:bg-background-elevated hover:border-border-dark transition-all duration-200 group"
                            >
                                <div className="flex items-start gap-3 mb-3">
                                    <div
                                        className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                                        style={{ backgroundColor: project.color || '#3b82f6' }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-text-primary truncate group-hover:text-primary transition-colors">
                                            {project.name}
                                        </h3>
                                        {project.description && (
                                            <p className="text-sm text-text-secondary mt-1 line-clamp-2">{project.description}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                                        {getProjectStatusDisplayLabel(project.status)}
                                    </span>
                                    <span
                                        className="px-2 py-0.5 rounded text-xs font-medium"
                                        style={{
                                            backgroundColor: (typeBadgeColors[project.projectType] || '#6b7280') + '20',
                                            color: typeBadgeColors[project.projectType] || '#6b7280',
                                        }}
                                    >
                                        {project.projectType}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-text-secondary">
                                        {stage}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-text-muted">
                                    {taskCount > 0 && (
                                        <span>
                                            ✅ {completedTasks}/{taskCount} tasks
                                        </span>
                                    )}
                                    {estHours > 0 ? <span>⏱ {estHours}h</span> : null}
                                    {project.endDate && (
                                        <span>
                                            📅{' '}
                                            {new Date(project.endDate).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
