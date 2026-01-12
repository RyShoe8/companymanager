'use client';

import { IProject } from '@/lib/models/Project';
import { formatDate } from '@/lib/utils/dateUtils';
import Card from '@/components/ui/Card';

interface ProjectBlockProps {
  project: IProject;
  onClick?: () => void;
  onDelete?: () => void;
}

export default function ProjectBlock({ project, onClick, onDelete }: ProjectBlockProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm('Are you sure you want to delete this project?')) {
      onDelete();
    }
  };

  return (
    <Card
      className="p-4 mb-3 relative"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: project.color }}
            />
            <h3 className="font-semibold text-gray-900 dark:text-white">{project.name}</h3>
            <span className={`text-xs px-2 py-1 rounded ${
              project.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              project.status === 'complete' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
              'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }`}>
              {project.status}
            </span>
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{project.description}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {formatDate(new Date(project.startDate))} - {formatDate(new Date(project.endDate))}
          </p>
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </Card>
  );
}
