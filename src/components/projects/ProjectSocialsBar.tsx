'use client';

import { useState, useCallback } from 'react';
import type { IProject, IProjectSocialLink } from '@/lib/models/Project';
import Button from '@/components/ui/Button';
import BottomSheet, { QuickAction } from '@/components/ui/BottomSheet';
import SocialIcon from '@/components/projects/SocialIcon';
import {
  detectSocialNetwork,
  parseSocialLinkInput,
  SOCIAL_NETWORK_LABELS,
} from '@/lib/utils/socialUrls';

interface ProjectSocialsBarProps {
  socialLinks: IProjectSocialLink[];
  socialsToolbarVisible: boolean;
  isManagerOrAdmin: boolean;
  onUpdate: (updates: Partial<IProject>) => Promise<void>;
}

export default function ProjectSocialsBar({
  socialLinks,
  socialsToolbarVisible,
  isManagerOrAdmin,
  onUpdate,
}: ProjectSocialsBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const showToolbarButton = isManagerOrAdmin && socialsToolbarVisible !== false;
  const detected = draftUrl.trim() ? detectSocialNetwork(draftUrl) : null;

  const appendSocialLink = useCallback(
    async (raw: string) => {
      const parsed = parseSocialLinkInput(raw);
      if (!parsed) {
        alert('Enter a valid URL.');
        return false;
      }
      const exists = socialLinks.some((l) => l.url === parsed.url);
      if (exists) {
        alert('That social link is already on this project.');
        return false;
      }
      setSaving(true);
      try {
        await onUpdate({ socialLinks: [...socialLinks, parsed] });
        setDraftUrl('');
        setExpanded(false);
        return true;
      } catch {
        alert('Failed to save social link.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, socialLinks]
  );

  const handleRemoveToolbar = async () => {
    if (!confirm('Remove the Socials button from the project header? You can still add socials via Add → Socials.')) return;
    setSaving(true);
    try {
      await onUpdate({ socialsToolbarVisible: false });
      setExpanded(false);
    } catch {
      alert('Failed to update project.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLink = async (index: number) => {
    const next = socialLinks.filter((_, i) => i !== index);
    setSaving(true);
    try {
      await onUpdate({ socialLinks: next });
      setSelectedIndex(null);
    } catch {
      alert('Failed to delete social link.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 1500);
    } catch {
      alert('Could not copy to clipboard.');
    }
  };

  if (!isManagerOrAdmin && socialLinks.length === 0) return null;

  const selectedLink = selectedIndex != null ? socialLinks[selectedIndex] : null;

  return (
  <>
    <div className="flex flex-wrap items-center gap-2 text-sm min-w-0 w-full basis-full">
      {showToolbarButton && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={saving}
          onClick={() => setExpanded((v) => !v)}
        >
          Socials
        </Button>
      )}
      {socialLinks.map((link, index) => (
        <button
          key={`${link.network}-${link.url}-${index}`}
          type="button"
          title={SOCIAL_NETWORK_LABELS[link.network]}
          onClick={() => setSelectedIndex(index)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          <SocialIcon network={link.network} size={18} />
        </button>
      ))}
    </div>

    {expanded && showToolbarButton && (
      <div className="w-full basis-full space-y-2 rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-800/50">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Social profile URL</label>
        <input
          type="url"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="https://linkedin.com/company/..."
          disabled={saving}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void appendSocialLink(draftUrl);
          }}
        />
        {detected && draftUrl.trim() && (
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            Detected: <SocialIcon network={detected} size={14} /> {SOCIAL_NETWORK_LABELS[detected]}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={saving || !draftUrl.trim()} onClick={() => void appendSocialLink(draftUrl)}>
            {saving ? 'Saving…' : 'Add'}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => { setExpanded(false); setDraftUrl(''); }}>
            Cancel
          </Button>
          {socialLinks.length > 0 && (
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => void handleRemoveToolbar()}>
              Remove Socials button
            </Button>
          )}
        </div>
      </div>
    )}

    <BottomSheet
      isOpen={selectedIndex !== null && !!selectedLink}
      onClose={() => setSelectedIndex(null)}
      title={selectedLink ? SOCIAL_NETWORK_LABELS[selectedLink.network] : 'Social link'}
      elevated
    >
      {selectedLink && selectedIndex !== null && (
        <div className="p-2 pb-8">
          <QuickAction
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            }
            label="Open"
            onClick={() => {
              window.open(selectedLink.url, '_blank', 'noopener,noreferrer');
              setSelectedIndex(null);
            }}
          />
          <QuickAction
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
            label={copyFeedback ? 'Copied' : 'Copy URL'}
            onClick={() => void handleCopy(selectedLink.url)}
          />
          {isManagerOrAdmin && (
            <QuickAction
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              }
              label="Delete"
              variant="danger"
              onClick={() => void handleDeleteLink(selectedIndex)}
            />
          )}
        </div>
      )}
    </BottomSheet>
  </>
  );
}
