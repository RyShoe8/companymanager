'use client';

import Link from 'next/link';
import { IAsset } from '@/lib/models/Asset';
import Card from '@/components/ui/Card';

interface AssetCardProps {
  asset: IAsset;
  linkedProjectId?: string;
  linkedProjectName?: string;
  onClick?: () => void;
  onDelete?: () => void;
}

export default function AssetCard({
  asset,
  linkedProjectId,
  linkedProjectName,
  onClick,
  onDelete,
}: AssetCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm('Are you sure you want to delete this asset?')) {
      onDelete();
    }
  };

  const typeColors: Record<string, string> = {
    spreadsheet: 'bg-success/15 text-success',
    document: 'bg-secondary/15 text-secondary',
    tool: 'bg-accent/15 text-accent',
    folder: 'bg-warning/15 text-warning',
    link: 'bg-primary/15 text-primary',
    other: 'bg-background-elevated text-text-secondary',
  };

  const showProject = Boolean(linkedProjectId);
  const projectLabel = linkedProjectName ?? (linkedProjectId ? '(removed)' : undefined);

  return (
    <Card className="p-4 mb-3" onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-semibold text-text-primary">{asset.name}</h3>
            <span className={`text-xs px-2 py-1 rounded ${typeColors[asset.type] || typeColors.other}`}>
              {asset.type}
            </span>
            {asset.category && (
              <span className="text-xs px-2 py-1 rounded bg-background-elevated text-text-secondary">
                {asset.category}
              </span>
            )}
          </div>
          {showProject && projectLabel && (
            linkedProjectName && linkedProjectId ? (
              <Link
                href={`/assets?projectId=${linkedProjectId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-text-secondary hover:text-primary transition-colors mb-2 inline-block"
              >
                Project: {projectLabel}
              </Link>
            ) : (
              <p className="text-xs text-text-muted mb-2">Project: {projectLabel}</p>
            )
          )}
          {asset.description && (
            <p className="text-sm text-text-secondary mb-2">{asset.description}</p>
          )}
          {asset.url && (
            <a
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-primary hover:text-primary-hover"
            >
              {asset.url}
            </a>
          )}
          {asset.tags && asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {asset.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-1 rounded bg-background-elevated text-text-secondary"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="ml-2 text-error hover:opacity-80 transition-opacity"
            aria-label="Delete asset"
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
