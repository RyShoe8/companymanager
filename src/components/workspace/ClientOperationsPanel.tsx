'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import type {
  IProjectActionButton,
  IProjectMarketingStackItem,
  IProjectSocialLink,
  IProjectTechStackItem,
} from '@/lib/models/platformFields';
import EditableText from '@/components/ui/EditableText';
import ProjectSocialsBar from '@/components/projects/ProjectSocialsBar';
import ProjectTechStackBar from '@/components/projects/ProjectTechStackBar';
import ProjectMarketingStackBar from '@/components/projects/ProjectMarketingStackBar';
import AddButton from '@/components/checklist/AddButton';
import type { AddSmartButtonPayload } from '@/components/checklist/CategoryModal';
import { normalizeProjectUrlHref, truncateProjectUrlDisplay } from '@/lib/utils/projectUrls';
import { parseSocialLinkInput } from '@/lib/utils/socialUrls';
import { emailSmartButtonHref } from '@/lib/utils/emailSmartLinks';
import {
  aggregateClientPlatforms,
  projectsForClient,
} from '@/lib/clients/aggregateClientOperations';
import { clientIdStr } from '@/lib/clients/clientApiHelpers';
import { deleteLinkedAsset, canUserDeleteAsset } from '@/lib/utils/linkedAssets';
import AssetDeleteConfirmModal from '@/components/shared/AssetDeleteConfirmModal';
import HoverDeleteButton from '@/components/shared/HoverDeleteButton';
import { TECH_STACK_CATALOG } from '@/lib/techStack/catalog';
import { MARKETING_STACK_CATALOG } from '@/lib/marketingStack/catalog';
import { SOCIAL_NETWORK_LABELS } from '@/lib/utils/socialUrls';

type LinkedAssetRow = {
  _id: string;
  name: string;
  type: string;
  url?: string;
  fileUrl?: string;
  textContent?: string;
  userId?: string;
  source?: { type: string; projectId?: string; projectName?: string };
};

function formatLinkedAssetTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

function linkedAssetOpenHref(asset: LinkedAssetRow): string | null {
  if (asset.url?.trim()) return asset.url.trim();
  if (asset.fileUrl?.trim()) return asset.fileUrl.trim();
  return null;
}

function isTextDocumentAssetType(type: string): boolean {
  return type === 'text' || type === 'document';
}

interface ClientOperationsPanelProps {
  client: IClient;
  projects: IProject[];
  isManagerOrAdmin: boolean;
  currentUserId?: string;
  onUpdateClient: (clientId: string, updates: Partial<IClient> & Record<string, unknown>) => Promise<void> | void;
  onViewProject?: (project: IProject) => void;
}

export default function ClientOperationsPanel({
  client,
  projects,
  isManagerOrAdmin,
  currentUserId,
  onUpdateClient,
  onViewProject,
}: ClientOperationsPanelProps) {
  const clientId = clientIdStr(client._id);
  const [localClient, setLocalClient] = useState(client);
  const [actionButtons, setActionButtons] = useState<IProjectActionButton[]>(client.actionButtons ?? []);
  const [linkedAssets, setLinkedAssets] = useState<LinkedAssetRow[]>([]);
  const [aggregateAssets, setAggregateAssets] = useState<LinkedAssetRow[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetPendingDelete, setAssetPendingDelete] = useState<LinkedAssetRow | null>(null);

  useEffect(() => {
    setLocalClient(client);
    setActionButtons(client.actionButtons ?? []);
  }, [client]);

  const clientProjects = useMemo(() => projectsForClient(clientId, projects), [clientId, projects]);

  const aggregatedPlatforms = useMemo(
    () => aggregateClientPlatforms(localClient, clientProjects),
    [localClient, clientProjects]
  );

  const projectOnlyPlatforms = useMemo(() => {
    const fromProjects = <T extends { source: { type: string } }>(items: T[]) =>
      items.filter((i) => i.source.type === 'project');
    return {
      socialLinks: fromProjects(aggregatedPlatforms.socialLinks),
      techStack: fromProjects(aggregatedPlatforms.techStack),
      marketingStack: fromProjects(aggregatedPlatforms.marketingStack),
    };
  }, [aggregatedPlatforms]);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const [clientRes, allRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/assets?scope=client`),
        fetch(`/api/clients/${clientId}/assets?scope=all`),
      ]);
      if (clientRes.ok) {
        const rows = (await clientRes.json()) as LinkedAssetRow[];
        setLinkedAssets(rows);
      } else {
        setLinkedAssets([]);
      }
      if (allRes.ok) {
        const rows = (await allRes.json()) as LinkedAssetRow[];
        setAggregateAssets(rows);
      } else {
        setAggregateAssets([]);
      }
    } catch {
      setLinkedAssets([]);
      setAggregateAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const handleFieldUpdate = async (field: keyof IClient, value: unknown) => {
    setLocalClient((prev) => ({ ...prev, [field]: value } as IClient));
    try {
      await onUpdateClient(clientId, { [field]: value } as Partial<IClient>);
    } catch (error) {
      setLocalClient(client);
      alert(error instanceof Error ? error.message : 'Failed to save');
    }
  };

  const portalUrl =
    localClient.clientPortalSlug && localClient.clientPortalToken
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${localClient.clientPortalSlug}?token=${encodeURIComponent(localClient.clientPortalToken)}`
      : null;

  const techName = (id: string) => TECH_STACK_CATALOG.find((t) => t.id === id)?.name ?? id;
  const marketingName = (id: string) => MARKETING_STACK_CATALOG.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="bg-background-elevated rounded-xl border border-border p-5 space-y-4">
      <h3 className="text-sm font-medium text-text-primary">Client operations</h3>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {isManagerOrAdmin ? (
          <>
            <EditableText
              value={localClient.devUrl ?? ''}
              onSave={(v) => handleFieldUpdate('devUrl', v.trim())}
              className="min-w-0 max-w-[11rem] text-text-primary"
              placeholder="Dev URL"
            />
            {normalizeProjectUrlHref(localClient.devUrl ?? '') ? (
              <a
                href={normalizeProjectUrlHref(localClient.devUrl ?? '')!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-0.5 rounded border border-border hover:bg-background-accent"
              >
                Open
              </a>
            ) : null}
          </>
        ) : normalizeProjectUrlHref(localClient.devUrl ?? '') ? (
          <a href={normalizeProjectUrlHref(localClient.devUrl ?? '')!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {truncateProjectUrlDisplay(localClient.devUrl ?? '', 40)}
          </a>
        ) : (
          <span className="text-text-tertiary text-xs">No dev URL</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {isManagerOrAdmin ? (
          <>
            <EditableText
              value={localClient.liveUrl ?? ''}
              onSave={(v) => handleFieldUpdate('liveUrl', v.trim())}
              className="min-w-0 max-w-[11rem] text-text-primary"
              placeholder="Live URL"
            />
            {normalizeProjectUrlHref(localClient.liveUrl ?? '') ? (
              <a
                href={normalizeProjectUrlHref(localClient.liveUrl ?? '')!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-0.5 rounded border border-border hover:bg-background-accent"
              >
                Open
              </a>
            ) : null}
          </>
        ) : normalizeProjectUrlHref(localClient.liveUrl ?? '') ? (
          <a href={normalizeProjectUrlHref(localClient.liveUrl ?? '')!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {truncateProjectUrlDisplay(localClient.liveUrl ?? '', 40)}
          </a>
        ) : (
          <span className="text-text-tertiary text-xs">No live URL</span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background p-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Platforms</p>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectSocialsBar
            socialLinks={(localClient.socialLinks ?? []) as IProjectSocialLink[]}
            socialsToolbarVisible={localClient.socialsToolbarVisible !== false}
            isManagerOrAdmin={isManagerOrAdmin}
            surface="workspace"
            onUpdate={async (updates) => {
              setLocalClient((prev) => ({ ...prev, ...updates } as unknown as IClient));
              await onUpdateClient(clientId, updates as Partial<IClient>);
            }}
          />
          <ProjectTechStackBar
            techStack={(localClient.techStack ?? []) as IProjectTechStackItem[]}
            isManagerOrAdmin={isManagerOrAdmin}
            surface="workspace"
            onUpdate={async (updates) => {
              setLocalClient((prev) => ({ ...prev, ...updates } as unknown as IClient));
              await onUpdateClient(clientId, updates as Partial<IClient>);
            }}
          />
          <ProjectMarketingStackBar
            marketingStack={(localClient.marketingStack ?? []) as IProjectMarketingStackItem[]}
            isManagerOrAdmin={isManagerOrAdmin}
            surface="workspace"
            onUpdate={async (updates) => {
              setLocalClient((prev) => ({ ...prev, ...updates } as unknown as IClient));
              await onUpdateClient(clientId, updates as Partial<IClient>);
            }}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Client assets</h4>
        {assetsLoading ? (
          <p className="text-xs text-text-tertiary">Loading…</p>
        ) : linkedAssets.length === 0 ? (
          <p className="text-xs text-text-tertiary">No client-linked assets yet. Use Add → Document or link from the Assets page.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {linkedAssets.map((asset) => {
              const href = linkedAssetOpenHref(asset);
              const deleteBtn =
                canUserDeleteAsset(asset.userId, currentUserId, isManagerOrAdmin) ? (
                  <HoverDeleteButton label={`Delete ${asset.name}`} onClick={() => setAssetPendingDelete(asset)} />
                ) : null;
              return (
                <span key={asset._id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 max-w-[260px]">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                      {asset.name}
                    </a>
                  ) : (
                    <span className="truncate">{asset.name}</span>
                  )}
                  {deleteBtn}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {(actionButtons.length > 0 || isManagerOrAdmin) && (
        <div className="pt-2 border-t border-border">
          <div className="flex flex-wrap items-center gap-2">
            {actionButtons.map((btn, idx) => {
              const isEmail = btn.kind === 'email';
              const linkHref = isEmail ? (emailSmartButtonHref(btn.url)?.href ?? '#') : (normalizeProjectUrlHref(btn.url) ?? '#');
              return (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${isEmail ? 'bg-violet-50 text-violet-800' : 'bg-primary/10 text-primary'}`}
                >
                  <a href={linkHref} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline truncate max-w-[160px]">
                    {btn.label}
                  </a>
                  {isManagerOrAdmin && (
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await fetch(`/api/clients/${clientId}/buttons`, {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ index: idx }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setActionButtons(Array.isArray(data) ? data : []);
                        }
                      }}
                      className="p-0.5 opacity-70 hover:opacity-100"
                      aria-label="Remove button"
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
            {isManagerOrAdmin && (
              <AddButton
                clientId={clientId}
                linkContext={{ linkedClientId: clientId }}
                socialsToolbarHidden={localClient.socialsToolbarVisible === false}
                triggerVariant="primary"
                label="+ Add"
                onAddSocial={async (url) => {
                  const parsed = parseSocialLinkInput(url);
                  if (!parsed) throw new Error('Invalid URL');
                  const existing = (localClient.socialLinks ?? []) as IProjectSocialLink[];
                  if (existing.some((l) => l.url === parsed.url)) {
                    alert('That social link is already on this client.');
                    return;
                  }
                  await handleFieldUpdate('socialLinks', [...existing, parsed]);
                }}
                onAddButton={async (payload: AddSmartButtonPayload) => {
                  const body =
                    payload.kind === 'email'
                      ? {
                          kind: 'email',
                          email: payload.email,
                          ...(payload.label ? { label: payload.label } : {}),
                        }
                      : { label: payload.label, url: payload.url };
                  const res = await fetch(`/api/clients/${clientId}/buttons`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setActionButtons(Array.isArray(data) ? data : []);
                  }
                }}
                onDocumentCreated={() => void loadAssets()}
              />
            )}
          </div>
        </div>
      )}

      {(projectOnlyPlatforms.techStack.length > 0 ||
        projectOnlyPlatforms.marketingStack.length > 0 ||
        projectOnlyPlatforms.socialLinks.length > 0 ||
        aggregateAssets.some((a) => a.source?.type === 'project')) && (
        <div className="pt-2 border-t border-border">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Across projects</h4>
          <div className="space-y-2 text-xs text-text-secondary">
            {projectOnlyPlatforms.techStack.map((item, i) => (
              <div key={`tech-${i}`} className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-text-primary">{techName(item.technologyId)}</span>
                <span className="text-text-tertiary">({item.category})</span>
                <span className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]">
                  {item.source.type === 'project' ? (item.source as { projectName: string }).projectName : 'Client'}
                </span>
                {item.source.type === 'project' && onViewProject && (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      const p = clientProjects.find(
                        (pr) => String(pr._id) === (item.source as { projectId: string }).projectId
                      );
                      if (p) onViewProject(p);
                    }}
                  >
                    Open project
                  </button>
                )}
              </div>
            ))}
            {projectOnlyPlatforms.marketingStack.map((item, i) => (
              <div key={`mkt-${i}`} className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-text-primary">{marketingName(item.toolId)}</span>
                <span className="text-text-tertiary">({item.category})</span>
                <span className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]">
                  {item.source.type === 'project' ? (item.source as { projectName: string }).projectName : 'Client'}
                </span>
              </div>
            ))}
            {projectOnlyPlatforms.socialLinks.map((item, i) => (
              <div key={`soc-${i}`} className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-text-primary">{SOCIAL_NETWORK_LABELS[item.network] ?? item.network}</span>
                <span className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]">
                  {item.source.type === 'project' ? (item.source as { projectName: string }).projectName : 'Client'}
                </span>
              </div>
            ))}
            {aggregateAssets
              .filter((a) => a.source?.type === 'project')
              .map((asset) => (
                <div key={asset._id} className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-text-primary">{asset.name}</span>
                  <span className="text-text-tertiary">· {formatLinkedAssetTypeLabel(asset.type)}</span>
                  <span className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px]">
                    {(asset.source as { projectName?: string })?.projectName ?? 'Project'}
                  </span>
                  {onViewProject && (asset.source as { projectId?: string })?.projectId && (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        const p = clientProjects.find(
                          (pr) => String(pr._id) === (asset.source as { projectId?: string }).projectId
                        );
                        if (p) onViewProject(p);
                      }}
                    >
                      Open project
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {isManagerOrAdmin && (
        <div className="pt-2 border-t border-border">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Client portal</h4>
          {portalUrl ? (
            <div className="space-y-2">
              <p className="text-xs text-text-secondary break-all">{portalUrl}</p>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-border hover:bg-background-accent"
                onClick={() => navigator.clipboard.writeText(portalUrl)}
              >
                Copy portal link
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
              onClick={() => onUpdateClient(clientId, { ensurePortal: true })}
            >
              Generate portal link
            </button>
          )}
        </div>
      )}

      <AssetDeleteConfirmModal
        isOpen={!!assetPendingDelete}
        assetName={assetPendingDelete?.name ?? ''}
        assetTypeLabel={assetPendingDelete ? formatLinkedAssetTypeLabel(assetPendingDelete.type) : undefined}
        onCancel={() => setAssetPendingDelete(null)}
        onConfirm={async () => {
          if (!assetPendingDelete) return;
          await deleteLinkedAsset(assetPendingDelete._id);
          setAssetPendingDelete(null);
          void loadAssets();
        }}
      />
    </div>
  );
}
