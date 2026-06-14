'use client';

import { useState, useCallback } from 'react';
import type { IProject, IProjectSocialLink } from '@/lib/models/Project';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ModalAction from '@/components/ui/ModalAction';
import SocialIcon from '@/components/projects/SocialIcon';
import PlatformCredentialModal, { PlatformCredential, PlatformInfo } from '@/components/projects/PlatformCredentialModal';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';
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
  const light = useInspectorLight();
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

  const handleSaveCredentials = async (index: number, credentials: PlatformCredential) => {
    const updatedLinks = [...socialLinks];
    updatedLinks[index] = { ...updatedLinks[index], ...credentials };
    setSaving(true);
    try {
      await onUpdate({ socialLinks: updatedLinks });
      setSelectedIndex(null);
    } catch {
      alert('Failed to save credentials.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCredentials = async (index: number) => {
    const updatedLinks = [...socialLinks];
    updatedLinks[index] = { ...updatedLinks[index], login: undefined, password: undefined };
    setSaving(true);
    try {
      await onUpdate({ socialLinks: updatedLinks });
      setSelectedIndex(null);
    } catch {
      alert('Failed to delete credentials.');
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
    <div className="flex flex-wrap items-center gap-2 text-sm min-w-0">
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
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${lightSurface(
            'border border-gray-200 bg-white hover:bg-gray-50',
            'dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600',
            light
          )}`}
        >
          <SocialIcon network={link.network} size={18} />
        </button>
      ))}
    </div>

    {expanded && showToolbarButton && (
      <div className={`w-full basis-full space-y-2 rounded-lg border p-3 ${lightSurface(
        'border-gray-200 bg-gray-50',
        'dark:border-gray-600 dark:bg-gray-800/50',
        light
      )}`}>
        <label className={`block text-xs font-medium ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>Social profile URL</label>
        <input
          type="url"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="https://linkedin.com/company/..."
          disabled={saving}
          className={`w-full px-3 py-2 border rounded-lg text-sm ${lightSurface(
            'border-gray-200 bg-white text-gray-900',
            'dark:border-gray-600 dark:bg-gray-700 dark:text-white',
            light
          )}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void appendSocialLink(draftUrl);
          }}
        />
        {detected && draftUrl.trim() && (
          <p className={`text-xs flex items-center gap-1.5 ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
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
        </div>
      </div>
    )}

    <PlatformCredentialModal
      isOpen={selectedIndex !== null && !!selectedLink}
      onClose={() => setSelectedIndex(null)}
      platform={{
        name: selectedLink ? SOCIAL_NETWORK_LABELS[selectedLink.network] : 'Social link',
        icon: selectedLink ? <SocialIcon network={selectedLink.network} size={24} /> : null,
        url: selectedLink?.url || '',
      }}
      credentials={{
        login: selectedLink?.login,
        password: selectedLink?.password,
      }}
      onSave={(credentials) => {
        if (selectedIndex !== null) {
          return handleSaveCredentials(selectedIndex, credentials);
        }
        return Promise.resolve();
      }}
      onDelete={isManagerOrAdmin ? () => {
        if (selectedIndex !== null) {
          return handleDeleteCredentials(selectedIndex);
        }
        return Promise.resolve();
      } : undefined}
      canEdit={isManagerOrAdmin}
      canViewPassword={isManagerOrAdmin}
    />
  </>
  );
}
