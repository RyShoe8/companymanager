'use client';

import { useState, useMemo } from 'react';
import { IProject } from '@/lib/models/Project';
import { mapStatusToStage } from '@/lib/utils/statusMapping';

interface ProjectsLensProps {
    projects: IProject[];
    onProjectClick: (project: IProject) => void;
}

const statusBadgeColors: Record<string, { bg: string; text: string }> = {
    planning: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    'in-development': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    launched: { bg: 'bg-green-500/20', text: 'text-green-400' },
    'in-review': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    completed: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
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
    onProjectClick,
}: ProjectsLensProps) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'name' | 'updated' | 'status'>('updated');

    const filtered = useMemo(() => {
        let result = [...projects];

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    p.description?.toLowerCase().includes(q)
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter((p) => p.status === statusFilter);
        }

        // Type filter
        if (typeFilter !== 'all') {
            result = result.filter((p) => p.projectType === typeFilter);
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'status') return a.status.localeCompare(b.status);
            // Default: updated (newest first)
            const aDate = new Date((a as any).updatedAt || a.createdAt).getTime();
            const bDate = new Date((b as any).updatedAt || b.createdAt).getTime();
            return bDate - aDate;
        });

        return result;
    }, [projects, search, statusFilter, typeFilter, sortBy]);

    return (
        <div>
            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <input
                    type="text"
                    placeholder="Search projects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-400 px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded border border-gray-600 bg-gray-800 text-white px-2 py-2 text-sm"
                >
                    <option value="all">All statuses</option>
                    <option value="planning">Planning</option>
                    <option value="in-development">In Development</option>
                    <option value="launched">Launched</option>
                    <option value="in-review">In Review</option>
                    <option value="completed">Completed</option>
                </select>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="rounded border border-gray-600 bg-gray-800 text-white px-2 py-2 text-sm"
                >
                    <option value="all">All types</option>
                    <option value="website">Website</option>
                    <option value="store">Store</option>
                    <option value="app">App</option>
                    <option value="generic">Generic</option>
                    <option value="internal">Internal</option>
                    <option value="client">Client</option>
                </select>
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="rounded border border-gray-600 bg-gray-800 text-white px-2 py-2 text-sm"
                >
                    <option value="updated">Recently updated</option>
                    <option value="name">Name A–Z</option>
                    <option value="status">Status</option>
                </select>
                <span className="text-sm text-gray-400 ml-auto">
                    {filtered.length} project{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Project cards */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <p className="text-lg mb-2">No projects match your filters</p>
                    <p className="text-sm text-gray-500">Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((project) => {
                        const stage = mapStatusToStage(project.status as any);
                        const colors = statusBadgeColors[project.status] || statusBadgeColors.planning;
                        const taskCount = project.tasks?.length || 0;
                        const completedTasks = project.tasks?.filter((t) => t.status === 'completed').length || 0;

                        return (
                            <div
                                key={project._id.toString()}
                                onClick={() => onProjectClick(project)}
                                className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-all duration-200 group"
                            >
                                {/* Header */}
                                <div className="flex items-start gap-3 mb-3">
                                    <div
                                        className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                                        style={{ backgroundColor: project.color || '#3b82f6' }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-white truncate group-hover:text-primary transition-colors">
                                            {project.name}
                                        </h3>
                                        {project.description && (
                                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{project.description}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                                        {project.status.replace('-', ' ')}
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
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
                                        {stage}
                                    </span>
                                </div>

                                {/* Stats row */}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    {taskCount > 0 && (
                                        <span>
                                            ✅ {completedTasks}/{taskCount} tasks
                                        </span>
                                    )}
                                    {project.estimatedHours ? (
                                        <span>⏱ {project.estimatedHours}h</span>
                                    ) : null}
                                    {project.endDate && (
                                        <span>
                                            📅 {new Date(project.endDate).toLocaleDateString('en-US', {
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
