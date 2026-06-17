'use client';

import { useMemo, useState } from 'react';
import SocialIcon from '@/components/projects/SocialIcon';
import TechStackIcon from '@/components/projects/TechStackIcon';
import MarketingStackIcon from '@/components/projects/MarketingStackIcon';
import PlatformCredentialModal, { PlatformCredential, PlatformInfo } from '@/components/projects/PlatformCredentialModal';
import type { MeetingDetailProjectResources } from '@/lib/scheduling/buildMeetingDetailPayload';
import { parseCssColorInput } from '@/lib/utils/cssColorInput';
import { emailSmartButtonHref } from '@/lib/utils/emailSmartLinks';
import { parseFontFamilyInput } from '@/lib/utils/fontPaletteInput';
import { getMarketingStackEntry } from '@/lib/utils/marketingStack';
import { normalizeProjectUrlHref, truncateProjectUrlDisplay } from '@/lib/utils/projectUrls';
import { SOCIAL_NETWORK_LABELS } from '@/lib/utils/socialUrls';
import { getTechStackEntry } from '@/lib/utils/techStack';

interface MeetingProjectInsightsProps {
  resources: MeetingDetailProjectResources;
  isManagerOrAdmin?: boolean;
}

function UrlRow({
  label,
  raw,
}: {
  label: string;
  raw?: string;
}) {
  const href = raw ? normalizeProjectUrlHref(raw) : null;
  return (
    <div className="flex items-center gap-2 text-sm min-w-0">
      <span className="text-text-muted shrink-0">{label}:</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate hover:underline text-primary max-w-[14rem] sm:max-w-[18rem]"
        >
          {truncateProjectUrlDisplay(raw ?? '', 48)}
        </a>
      ) : (
        <span className="text-text-muted">Not set</span>
      )}
    </div>
  );
}

export default function MeetingProjectInsights({ resources, isManagerOrAdmin = false }: MeetingProjectInsightsProps) {
  const [credentialModal, setCredentialModal] = useState<{
    platform: PlatformInfo;
    credentials: PlatformCredential;
  } | null>(null);
  const paletteSwatches = useMemo(() => {
    const raw =
      resources.colorPalette.length > 0
        ? resources.colorPalette
        : [resources.projectColor || '#3b82f6'];
    const out: string[] = [];
    for (const c of raw) {
      if (typeof c !== 'string') continue;
      const p = parseCssColorInput(c.trim());
      if (p.ok) out.push(p.normalized);
      if (out.length >= 6) break;
    }
    if (out.length === 0) {
      const p = parseCssColorInput(String(resources.projectColor || '#3b82f6'));
      out.push(p.ok ? p.normalized : '#3b82f6');
    }
    return out;
  }, [resources.colorPalette, resources.projectColor]);

  const fontNames = useMemo(() => {
    const out: string[] = [];
    for (const f of resources.fontPalette) {
      if (typeof f !== 'string') continue;
      const t = f.trim();
      if (!t) continue;
      const p = parseFontFamilyInput(t);
      if (p.ok) out.push(p.normalized);
    }
    return out;
  }, [resources.fontPalette]);

  const hasMeta =
    resources.projectType ||
    resources.category ||
    resources.description?.trim();

  const hasStacks =
    resources.socialLinks.length > 0 ||
    resources.techStack.length > 0 ||
    resources.marketingStack.length > 0;

  const hasUrls =
    resources.devUrl ||
    resources.liveUrl ||
    resources.urls.length > 0 ||
    resources.actionButtons.length > 0;

  if (!hasMeta && !hasStacks && !hasUrls && paletteSwatches.length === 0 && fontNames.length === 0) {
    return null;
  }

  return (
    <div className="pt-3 space-y-3">
      {hasMeta && (
        <div className="space-y-1 text-sm">
          {(resources.projectType || resources.category) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-text-secondary">
              {resources.projectType && (
                <span>
                  <span className="text-text-muted">Type:</span> {resources.projectType}
                </span>
              )}
              {resources.category && (
                <span>
                  <span className="text-text-muted">Category:</span> {resources.category}
                </span>
              )}
            </div>
          )}
          {resources.description?.trim() && (
            <p className="text-text-secondary">{resources.description.trim()}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <UrlRow label="Dev" raw={resources.devUrl} />
        <UrlRow label="Live" raw={resources.liveUrl} />
      </div>

      {resources.urls.length > 0 && (
        <ul className="text-xs space-y-1">
          {resources.urls.map((url) => {
            const href = normalizeProjectUrlHref(url);
            if (!href) return null;
            return (
              <li key={url}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary-hover break-all"
                >
                  {url}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {(paletteSwatches.length > 0 || fontNames.length > 0) && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {paletteSwatches.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-text-muted text-xs uppercase tracking-wide">Colors</span>
              <span className="flex -space-x-1" aria-label="Color palette">
                {paletteSwatches.map((swatch, i) => (
                  <span
                    key={`${swatch}-${i}`}
                    className="inline-block h-5 w-5 rounded-full border border-background ring-1 ring-border"
                    style={{ backgroundColor: swatch, zIndex: paletteSwatches.length - i }}
                    title={swatch}
                  />
                ))}
              </span>
            </div>
          )}
          {fontNames.length > 0 && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-text-muted text-xs uppercase tracking-wide shrink-0">Fonts</span>
              <span className="text-text-secondary truncate">
                {fontNames.map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    style={
                      /^[\p{L}\p{N}\s\-]+$/u.test(name) && !name.includes(',')
                        ? { fontFamily: name }
                        : undefined
                    }
                  >
                    {i > 0 ? ' · ' : ''}
                    {name}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
      )}

      {resources.socialLinks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-text-muted w-full sm:w-auto">Socials</span>
          {resources.socialLinks.map((link, index) => (
            <button
              key={`${link.network}-${link.url}-${index}`}
              type="button"
              onClick={() => setCredentialModal({
                platform: {
                  name: SOCIAL_NETWORK_LABELS[link.network],
                  icon: <SocialIcon network={link.network} size={24} />,
                  url: link.url,
                },
                credentials: {
                  login: link.login,
                  password: link.password,
                },
              })}
              title={SOCIAL_NETWORK_LABELS[link.network]}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background-elevated/40 hover:bg-background-elevated transition-colors cursor-pointer"
            >
              <SocialIcon network={link.network} size={18} />
            </button>
          ))}
        </div>
      )}

      {resources.techStack.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-text-muted w-full sm:w-auto">Tech stack</span>
          {resources.techStack.map((item, index) => {
            const entry = getTechStackEntry(item.technologyId);
            return (
              <button
                key={`${item.technologyId}-${index}`}
                type="button"
                onClick={() => entry && setCredentialModal({
                  platform: {
                    name: entry.name,
                    icon: <TechStackIcon technologyId={item.technologyId} size={24} />,
                    url: entry.homepageUrl,
                  },
                  credentials: {
                    login: item.login,
                    password: item.password,
                  },
                })}
                title={entry?.name ?? item.technologyId}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background-elevated/40 hover:bg-background-elevated transition-colors cursor-pointer"
              >
                <TechStackIcon technologyId={item.technologyId} size={18} />
              </button>
            );
          })}
        </div>
      )}

      {resources.marketingStack.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-text-muted w-full sm:w-auto">Marketing</span>
          {resources.marketingStack.map((item, index) => {
            const entry = getMarketingStackEntry(item.toolId);
            return (
              <button
                key={`${item.toolId}-${index}`}
                type="button"
                onClick={() => entry && setCredentialModal({
                  platform: {
                    name: entry.name,
                    icon: <MarketingStackIcon toolId={item.toolId} size={24} />,
                    url: entry.homepageUrl,
                  },
                  credentials: {
                    login: item.login,
                    password: item.password,
                  },
                })}
                title={entry?.name ?? item.toolId}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background-elevated/40 hover:bg-background-elevated transition-colors cursor-pointer"
              >
                <MarketingStackIcon toolId={item.toolId} size={18} />
              </button>
            );
          })}
        </div>
      )}

      {resources.actionButtons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resources.actionButtons.map((btn, idx) => {
            const isEmail = btn.kind === 'email';
            const emailLink = isEmail ? emailSmartButtonHref(btn.url) : null;
            const linkHref = emailLink?.href ?? normalizeProjectUrlHref(btn.url);
            const openInNewTab = isEmail ? !!emailLink?.openInNewTab : true;
            if (!linkHref) return null;
            return (
              <a
                key={`${btn.label}-${btn.url}-${idx}`}
                href={linkHref}
                {...(openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isEmail
                    ? 'bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {btn.label}
              </a>
            );
          })}
        </div>
      )}

      {credentialModal && (
        <PlatformCredentialModal
          isOpen={!!credentialModal}
          onClose={() => setCredentialModal(null)}
          platform={credentialModal.platform}
          credentials={credentialModal.credentials}
          onSave={() => Promise.resolve()}
          onRemovePlatform={undefined}
          canEdit={false}
          canViewPassword={isManagerOrAdmin}
        />
      )}
    </div>
  );
}
