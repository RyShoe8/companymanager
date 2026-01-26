'use client';

import { ProjectType } from '@/lib/models/Project';

interface ProjectTypeBadgeProps {
  type: ProjectType | string;
  className?: string;
}

const typeConfig: Record<string, { label: string; icon: string; colors: string }> = {
  website: {
    label: 'Website',
    icon: '🌐',
    colors: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  store: {
    label: 'Store',
    icon: '🛒',
    colors: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  app: {
    label: 'App',
    icon: '📱',
    colors: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  generic: {
    label: 'Generic',
    icon: '📁',
    colors: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  },
  // Legacy support
  internal: {
    label: 'Internal',
    icon: '🏢',
    colors: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  client: {
    label: 'Client',
    icon: '👤',
    colors: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  },
};

export default function ProjectTypeBadge({ type, className = '' }: ProjectTypeBadgeProps) {
  const config = typeConfig[type] || typeConfig.generic;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.colors} ${className}`}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}
