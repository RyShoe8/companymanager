'use client';

import { useCallback, useEffect, useState } from 'react';
import { IProject } from '@/lib/models/Project';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import Button from '@/components/ui/Button';
import AddButton from '@/components/checklist/AddButton';
import ScreenshotGallery from '@/components/shared/ScreenshotGallery';
import type { PendingAssetPayload } from '@/components/checklist/CategoryModal';
import { mapStatusToStage } from '@/lib/utils/statusMapping';
import { parseDelimitedList } from '@/lib/constants/contentDistribution';
import { linkedAssetHref, normalizeLinkedAssetChip, type LinkedAssetChip } from '@/lib/utils/linkedAssets';

interface ContentTargetingSectionProps {
  project: IProject;
  isManagerOrAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  keywords: string;
  onKeywordsChange: (value: string) => void;
  internalLinks: string[];
  onInternalLinksChange: (links: string[]) => void;
  externalUrl: string;
  onExternalUrlChange: (value: string) => void;
  contentItemId?: string;
  mode?: 'live' | 'draft';
  pendingAssets?: PendingAssetPayload[];
  onPendingAsset?: (asset: PendingAssetPayload) => void;
  onRemovePendingAsset?: (index: number) => void;
}

export function parseKeywordsInput(text: string): string[] {
  return parseDelimitedList(text);
}

export default function ContentTargetingSection({
  project,
  isManagerOrAdmin,
  expanded,
  onToggle,
  keywords,
  onKeywordsChange,
  internalLinks,
  onInternalLinksChange,
  externalUrl,
  onExternalUrlChange,
  contentItemId,
  mode = 'live',
  pendingAssets = [],
  onPendingAsset,
  onRemovePendingAsset,
}: ContentTargetingSectionProps) {
  const [linkedAssets, setLinkedAssets] = useState<LinkedAssetChip[]>([]);
  const [screenshotRefreshToken, setScreenshotRefreshToken] = useState(0);
  const projectId = project._id.toString();
  const phase = mapStatusToStage(project.status);
  const projectType = project.projectType || 'generic';

  const loadLinkedAssets = useCallback(async () => {
    if (!contentItemId || mode === 'draft') return;
    try {
      const res = await fetch(`/api/assets?linkedContentItemId=${contentItemId}`);
      if (!res.ok) {
        setLinkedAssets([]);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        setLinkedAssets([]);
        return;
      }
      setLinkedAssets(data.map(normalizeLinkedAssetChip).filter((x): x is LinkedAssetChip => x != null));
    } catch {
      setLinkedAssets([]);
    }
  }, [contentItemId, mode]);

  useEffect(() => {
    void loadLinkedAssets();
  }, [loadLinkedAssets]);

  const addInternalLink = () => onInternalLinksChange([...internalLinks, '']);
  const updateInternalLink = (index: number, value: string) => {
    const next = [...internalLinks];
    next[index] = value;
    onInternalLinksChange(next);
  };
  const removeInternalLink = (index: number) => {
    onInternalLinksChange(internalLinks.filter((_, i) => i !== index));
  };

  return (
    <>
      <TargetingToggle expanded={expanded} onToggle={onToggle} />

      {expanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Target keywords</label>
            <AutoGrowTextarea
              value={keywords}
              onChange={(e) => onKeywordsChange(e.target.value)}
              placeholder="e.g. keyword1, keyword2 (comma or newline separated)"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-text-primary">Internal links</label>
              <Button type="button" variant="secondary" size="sm" onClick={addInternalLink}>
                + Add internal link
              </Button>
            </div>
            {internalLinks.length === 0 && (
              <p className="text-xs text-text-secondary mb-2">No internal links yet.</p>
            )}
            {internalLinks.map((link, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <AutoGrowTextarea
                  value={link}
                  onChange={(e) => updateInternalLink(index, e.target.value)}
                  placeholder="/page1 or https://..."
                  minRows={1}
                  className="flex-1"
                />
                <Button type="button" variant="danger" size="sm" onClick={() => removeInternalLink(index)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">External link</label>
            <AutoGrowTextarea
              value={externalUrl}
              onChange={(e) => onExternalUrlChange(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Assets</label>
            {isManagerOrAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                {contentItemId && mode === 'live' && (
                  <ScreenshotGallery
                    compact
                    entityType="contentItem"
                    entityId={contentItemId}
                    isManagerOrAdmin={isManagerOrAdmin}
                    refreshToken={screenshotRefreshToken}
                  />
                )}
                <AddButton
                  projectId={projectId}
                  phase={phase}
                  projectType={projectType}
                  isManagerOrAdmin={isManagerOrAdmin}
                  label="Add asset"
                  mode={mode}
                  linkContext={{
                    linkedProjectId: projectId,
                    ...(contentItemId ? { linkedContentItemId: contentItemId } : {}),
                  }}
                  onPendingAsset={onPendingAsset}
                  onDocumentCreated={() => {
                    void loadLinkedAssets();
                    setScreenshotRefreshToken((n) => n + 1);
                  }}
                  onAddButton={async () => {}}
                />
              </div>
            )}
            {mode === 'draft' && pendingAssets.length > 0 && (
              <ul className="mt-2 space-y-1">
                {pendingAssets.map((asset, index) => (
                  <li key={`${asset.name}-${index}`} className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                    <span className="truncate">{asset.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemovePendingAsset?.(index)}
                      className="text-red-500 hover:text-red-400 text-xs shrink-0"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {mode === 'live' && linkedAssets.filter((a) => a.type !== 'screenshot').length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {linkedAssets.filter((a) => a.type !== 'screenshot').map((asset) => {
                  const href = linkedAssetHref(asset);
                  return href ? (
                    <a
                      key={asset._id}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:underline"
                    >
                      {asset.name}
                    </a>
                  ) : (
                    <span
                      key={asset._id}
                      className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    >
                      {asset.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function TargetingToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <div className="pt-2 border-t border-gray-700">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-full focus:outline-none"
      >
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Targeting, Assets and Links
      </button>
    </div>
  );
}
