'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import SocialIcon from '@/components/projects/SocialIcon';
import ScreenshotToolPanel from '@/components/shared/ScreenshotToolPanel';
import RecordingToolPanel from '@/components/shared/RecordingToolPanel';
import { detectSocialNetwork, parseSocialLinkInput, SOCIAL_NETWORK_LABELS } from '@/lib/utils/socialUrls';
import type { MediaUploadTarget } from '@/lib/mediaUploadTarget';

import { openGoogleDrivePicker } from '@/lib/google/loadPicker';
import { useGoogleWorkspace } from '@/hooks/google/useGoogleWorkspace';

type AddStep =
  | 'type'
  | 'link'
  | 'email'
  | 'note'
  | 'googleDocument'
  | 'googleSpreadsheet'
  | 'googleFile'
  | 'social'
  | 'screenshot'
  | 'recording';

export type AddSmartButtonPayload =
  | { kind: 'link'; label: string; url: string }
  | { kind: 'email'; email: string; label?: string };

export type PendingAssetPayload = {
  name: string;
  type: 'text' | 'link';
  url?: string;
  textContent?: string;
  linkedProjectId?: string;
  linkedClientId?: string;
  linkedContentItemId?: string;
  linkedProjectTaskId?: string;
  linkedProjectTaskIndex?: number;
  tags?: string[];
};

export type AssetLinkContext = {
  linkedProjectId?: string;
  linkedClientId?: string;
  linkedContentItemId?: string;
  linkedProjectTaskId?: string;
  linkedProjectTaskIndex?: number;
};

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const ct = res.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (data && typeof data.error === 'string') return data.error;
      if (data && typeof data.message === 'string') return data.message;
    } else {
      const text = (await res.text()).trim().slice(0, 200);
      if (text) return text;
    }
  } catch {
    // ignore parse failures
  }
  return fallback;
}

interface CategoryModalProps {
  projectId?: string;
  clientId?: string;
  onClose: () => void;
  onAddButton: (payload: AddSmartButtonPayload) => Promise<void>;
  onDocumentCreated?: (asset?: unknown) => void;
  linkContext?: AssetLinkContext;
  mode?: 'live' | 'draft';
  onPendingAsset?: (asset: PendingAssetPayload) => void;
  socialsToolbarHidden?: boolean;
  onAddSocial?: (url: string) => Promise<void>;
  panelRef?: React.RefObject<HTMLDivElement | null>;
  /** Above parent modal (z-[110]). */
  stackAboveLightbox?: boolean;
}

export default function CategoryModal({
  projectId,
  clientId,
  onClose,
  onAddButton,
  onDocumentCreated,
  linkContext,
  mode = 'live',
  onPendingAsset,
  socialsToolbarHidden = false,
  onAddSocial,
  panelRef,
  stackAboveLightbox = false,
}: CategoryModalProps) {
  const [step, setStep] = useState<AddStep>('type');
  const [addLabel, setAddLabel] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [docName, setDocName] = useState('');
  const [docContent, setDocContent] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [emailAddr, setEmailAddr] = useState('');
  const [emailLabel, setEmailLabel] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const [socialUrl, setSocialUrl] = useState('');
  const [addingSocial, setAddingSocial] = useState(false);
  const [googleName, setGoogleName] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [uploadFileInput, setUploadFileInput] = useState<File | null>(null);
  const effectiveProjectId = linkContext?.linkedProjectId ?? projectId;
  const effectiveClientId = linkContext?.linkedClientId ?? clientId;
  const googleWorkspace = useGoogleWorkspace(linkContext, projectId, clientId);
  const defaultMediaTarget: MediaUploadTarget | null = effectiveProjectId
    ? { entityType: 'project', entityId: effectiveProjectId }
    : effectiveClientId
      ? { entityType: 'project', entityId: effectiveClientId }
      : null;

  const screenshotTarget = useMemo<MediaUploadTarget | null>(() => {
    if (
      linkContext?.linkedProjectTaskId ||
      linkContext?.linkedProjectTaskIndex != null
    ) {
      const entityId = linkContext.linkedProjectId ?? projectId;
      if (!entityId) return null;
      return {
        entityType: 'projectTask',
        entityId,
        taskId: linkContext.linkedProjectTaskId,
        taskIndex: linkContext.linkedProjectTaskIndex,
      };
    }
    if (linkContext?.linkedContentItemId) {
      return {
        entityType: 'contentItem',
        entityId: linkContext.linkedContentItemId,
      };
    }
    const pid = linkContext?.linkedProjectId ?? projectId;
    if (pid) {
      return { entityType: 'project', entityId: pid };
    }
    const cid = linkContext?.linkedClientId ?? clientId;
    if (cid) {
      return { entityType: 'project', entityId: cid };
    }
    return null;
  }, [linkContext, projectId, clientId]);

  const isEntityContext = !!(
    linkContext?.linkedContentItemId ||
    linkContext?.linkedProjectTaskId ||
    linkContext?.linkedProjectTaskIndex != null
  );
  const useAssetFlow = isEntityContext || mode === 'draft';
  const entitySubmitLabel =
    linkContext?.linkedProjectTaskId || linkContext?.linkedProjectTaskIndex != null
      ? 'Add'
      : isEntityContext
        ? 'Add asset'
        : 'Add to project';

  const buildAssetPayload = (partial: Omit<PendingAssetPayload, 'linkedProjectId' | 'linkedClientId'>): PendingAssetPayload => {
    if (effectiveClientId && !effectiveProjectId && !linkContext?.linkedContentItemId && !linkContext?.linkedProjectTaskId && linkContext?.linkedProjectTaskIndex == null) {
      return {
        linkedClientId: effectiveClientId,
        linkedContentItemId: linkContext?.linkedContentItemId,
        linkedProjectTaskId: linkContext?.linkedProjectTaskId,
        linkedProjectTaskIndex: linkContext?.linkedProjectTaskIndex,
        tags: [],
        ...partial,
      };
    }
    return {
      linkedProjectId: effectiveProjectId!,
      linkedContentItemId: linkContext?.linkedContentItemId,
      linkedProjectTaskId: linkContext?.linkedProjectTaskId,
      linkedProjectTaskIndex: linkContext?.linkedProjectTaskIndex,
      tags: [],
      ...partial,
    };
  };

  const saveAsset = async (payload: PendingAssetPayload): Promise<boolean> => {
    if (mode === 'draft') {
      onPendingAsset?.(payload);
      return true;
    }
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onDocumentCreated?.();
        return true;
      }
      const msg = await readApiErrorMessage(res, 'Failed to create asset');
      alert(msg);
      return false;
    } catch {
      alert('Could not create asset. Check your connection and try again.');
      return false;
    }
  };

  const handleEntityLink = async (label: string, url: string) => {
    return saveAsset(buildAssetPayload({ name: label.trim(), type: 'link', url: url.trim() }));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleAddSubmit = async () => {
    if (!addLabel.trim() || !addUrl.trim()) return;
    setAdding(true);
    try {
      if (useAssetFlow) {
        const ok = await handleEntityLink(addLabel, addUrl);
        if (ok) onClose();
      } else {
        await onAddButton({ kind: 'link', label: addLabel.trim(), url: addUrl.trim() });
        onClose();
      }
    } catch {
      alert('Could not add to project. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!emailAddr.trim()) return;
    setAddingEmail(true);
    try {
      if (useAssetFlow) {
        const label = emailLabel.trim() || emailAddr.trim();
        const ok = await handleEntityLink(label, `mailto:${emailAddr.trim()}`);
        if (ok) onClose();
      } else {
        await onAddButton({
          kind: 'email',
          email: emailAddr.trim(),
          ...(emailLabel.trim() ? { label: emailLabel.trim() } : {}),
        });
        onClose();
      }
    } catch {
      alert('Could not add to project. Please try again.');
    } finally {
      setAddingEmail(false);
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;
    setSavingDoc(true);
    try {
      const ok = await saveAsset(
        buildAssetPayload({
          name: docName.trim(),
          type: 'text',
          textContent: docContent.trim() || undefined,
        })
      );
      if (ok) onClose();
    } finally {
      setSavingDoc(false);
    }
  };

  const runGoogleAction = async (
    googleStep: 'googleDocument' | 'googleSpreadsheet' | 'googleFile',
    action: () => Promise<unknown | false>
  ) => {
    const connected = await googleWorkspace.ensureConnected({
      step: googleStep,
      linkContext: googleWorkspace.linkFieldsFromContext(),
      draftName: googleName.trim() || undefined,
    });
    if (!connected) return;
    setGoogleBusy(true);
    try {
      const result = await action();
      if (result === false) return;
      googleWorkspace.clearPendingAction();
      onDocumentCreated?.();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Google action failed');
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGoogleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleName.trim()) return;
    await runGoogleAction('googleDocument', () => googleWorkspace.createDoc(googleName.trim()));
  };

  const handleGoogleSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleName.trim()) return;
    await runGoogleAction('googleSpreadsheet', () => googleWorkspace.createSheet(googleName.trim()));
  };

  const handleAttachFromDrive = async () => {
    await runGoogleAction('googleFile', async () => {
      const picked = await openGoogleDrivePicker();
      if (!picked) return false;
      await googleWorkspace.attachPickedFile(picked.id, picked.name);
    });
  };

  const handleUploadToDrive = async () => {
    if (!uploadFileInput) return;
    await runGoogleAction('googleFile', () =>
      googleWorkspace.uploadFile(uploadFileInput, googleName.trim() || uploadFileInput.name)
    );
  };

  useEffect(() => {
    const pending = googleWorkspace.readPendingAction();
    if (!pending || !googleWorkspace.status.connected) return;
    if (pending.draftName) setGoogleName(pending.draftName);
    if (pending.step === 'googleDocument' || pending.step === 'googleSpreadsheet' || pending.step === 'googleFile') {
      setStep(pending.step);
    }
  }, [googleWorkspace.status.connected]);

  const handleSocialSubmit = async () => {
    if (!onAddSocial || !socialUrl.trim()) return;
    const parsed = parseSocialLinkInput(socialUrl);
    if (!parsed) {
      alert('Enter a valid social URL.');
      return;
    }
    setAddingSocial(true);
    try {
      await onAddSocial(parsed.url);
      onClose();
    } catch {
      alert('Failed to save social link.');
    } finally {
      setAddingSocial(false);
    }
  };

  const renderStep = () => {
    if (step === 'type') {
      const typeOptions: { id: AddStep; label: string; desc: string }[] = [
        { id: 'note', label: 'Note', desc: 'In-app text note linked to this item' },
        { id: 'googleDocument', label: 'Document', desc: 'Create a Google Doc' },
        { id: 'googleSpreadsheet', label: 'Spreadsheet', desc: 'Create a Google Sheet' },
        { id: 'googleFile', label: 'File', desc: 'Attach from Drive or upload a file' },
        { id: 'screenshot', label: 'Screenshot', desc: 'Capture a screen or upload an image' },
        { id: 'recording', label: 'Recording', desc: 'Record screen + voice or upload video' },
        { id: 'link', label: 'Link', desc: 'Any URL with a button label' },
        { id: 'email', label: 'Email', desc: 'Mailbox address shortcut' },
      ];
      if (socialsToolbarHidden && onAddSocial && !useAssetFlow) {
        typeOptions.splice(1, 0, { id: 'social', label: 'Socials', desc: 'Add a social profile URL' });
      }
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Choose a type of link or content to add.</p>
          {typeOptions.map(({ id, label, desc }) => (
            <button
              key={id}
              type="button"
              onClick={() => setStep(id)}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
            >
              <span className="font-medium text-gray-900 dark:text-white">{label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{desc}</span>
            </button>
          ))}
        </div>
      );
    }

    if (step === 'note') {
      return (
        <form onSubmit={handleNoteSubmit} className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isEntityContext ? 'Create a note linked to this item.' : 'Create a note linked to this project.'}
          </p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Note name</label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. Brief, Notes"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Content (optional)</label>
            <AutoGrowTextarea
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              placeholder="Add content..."
              minRows={2}
              className="px-3 py-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm whitespace-pre-wrap"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={savingDoc || !docName.trim()}>
              {savingDoc ? 'Creating...' : 'Create note'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
          </div>
        </form>
      );
    }

    const googleConnectionHint = googleWorkspace.status.loading ? (
      <p className="text-xs text-gray-500 dark:text-gray-400">Checking Google connection…</p>
    ) : googleWorkspace.status.connected ? (
      <p className="text-xs text-green-600 dark:text-green-400">Google Drive connected</p>
    ) : (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        You&apos;ll connect Google Drive on first use (non-sensitive file access only).
      </p>
    );

    if (step === 'googleDocument') {
      return (
        <form onSubmit={(e) => void handleGoogleDocSubmit(e)} className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create a Google Doc and link it here. It will be shared with everyone on this project or client.
          </p>
          {googleConnectionHint}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Document name</label>
            <input
              type="text"
              value={googleName}
              onChange={(e) => setGoogleName(e.target.value)}
              placeholder="e.g. Meeting notes, Proposal"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={googleBusy || !googleName.trim()}>
              {googleBusy ? 'Creating...' : 'Create Google Doc'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
          </div>
        </form>
      );
    }

    if (step === 'googleSpreadsheet') {
      return (
        <form onSubmit={(e) => void handleGoogleSheetSubmit(e)} className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create a Google Sheet and link it here. It will be shared with everyone on this project or client.
          </p>
          {googleConnectionHint}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Spreadsheet name</label>
            <input
              type="text"
              value={googleName}
              onChange={(e) => setGoogleName(e.target.value)}
              placeholder="e.g. Budget, Tracker"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={googleBusy || !googleName.trim()}>
              {googleBusy ? 'Creating...' : 'Create Google Sheet'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
          </div>
        </form>
      );
    }

    if (step === 'googleFile') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Attach an existing Drive file or upload a new one. Linked files are shared with everyone on this project or client.
          </p>
          {googleConnectionHint}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Display name (upload only, optional)</label>
            <input
              type="text"
              value={googleName}
              onChange={(e) => setGoogleName(e.target.value)}
              placeholder="Defaults to file name"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Upload file</label>
            <input
              type="file"
              onChange={(e) => setUploadFileInput(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-700 dark:text-gray-200"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void handleAttachFromDrive()} disabled={googleBusy}>
              {googleBusy ? 'Working...' : 'Attach from Drive'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleUploadToDrive()}
              disabled={googleBusy || !uploadFileInput}
            >
              {googleBusy ? 'Uploading...' : 'Upload to Drive'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'email') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Add a mailbox shortcut. The email opens your mail app in a new tab.
          </p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email address</label>
            <input
              type="email"
              autoComplete="email"
              value={emailAddr}
              onChange={(e) => setEmailAddr(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Display label (optional)</label>
            <input
              type="text"
              value={emailLabel}
              onChange={(e) => setEmailLabel(e.target.value)}
              placeholder="Defaults to email address"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleEmailSubmit}
              disabled={addingEmail || !emailAddr.trim()}
            >
              {addingEmail ? 'Adding...' : 'Add to project'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'social') {
      const detected = socialUrl.trim() ? detectSocialNetwork(socialUrl) : null;
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Paste a social profile URL. We detect the network automatically.
          </p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Profile URL</label>
            <input
              type="url"
              value={socialUrl}
              onChange={(e) => setSocialUrl(e.target.value)}
              placeholder="https://linkedin.com/company/..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          {detected && socialUrl.trim() && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              Detected: <SocialIcon network={detected} size={14} /> {SOCIAL_NETWORK_LABELS[detected]}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void handleSocialSubmit()} disabled={addingSocial || !socialUrl.trim()}>
              {addingSocial ? 'Adding...' : 'Add social'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'screenshot') {
      return (
        <ScreenshotToolPanel
          target={screenshotTarget ?? defaultMediaTarget!}
          description={
            linkContext?.linkedProjectTaskId
              ? 'Attach a screenshot to this task.'
              : linkContext?.linkedContentItemId
                ? 'Attach a screenshot to this content item.'
                : 'Attach a screenshot to this project.'
          }
          onUploaded={(asset) => {
            onDocumentCreated?.(asset);
            onClose();
          }}
          onBack={() => setStep('type')}
          showBack
        />
      );
    }

    if (step === 'recording') {
      return (
        <RecordingToolPanel
          target={screenshotTarget ?? defaultMediaTarget!}
          description={
            linkContext?.linkedProjectTaskId
              ? 'Attach a recording to this task.'
              : linkContext?.linkedContentItemId
                ? 'Attach a recording to this content item.'
                : 'Attach a recording to this project.'
          }
          onUploaded={() => {
            onDocumentCreated?.();
            onClose();
          }}
          onBack={() => setStep('type')}
          showBack
        />
      );
    }

    if (step === 'link') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Add a link with a button label.</p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Button name</label>
            <input
              type="text"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              placeholder="e.g. Staging, Dashboard"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL</label>
            <input
              type="url"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddSubmit} disabled={adding || !addLabel.trim() || !addUrl.trim()}>
              {adding ? 'Adding...' : entitySubmitLabel}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  const zClass = stackAboveLightbox ? 'z-[120]' : 'z-[80]';

  const modal = (
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/50`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl mx-4 max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {step === 'type'
              ? 'Add'
              : step === 'note'
                ? 'Note'
                : step === 'googleDocument'
                  ? 'Document'
                  : step === 'googleSpreadsheet'
                    ? 'Spreadsheet'
                    : step === 'googleFile'
                      ? 'File'
                      : step === 'screenshot'
                        ? 'Screenshot'
                        : step === 'recording'
                          ? 'Recording'
                          : step === 'link'
                            ? 'Link'
                            : step === 'email'
                              ? 'Email'
                              : 'Socials'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{renderStep()}</div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;

  return createPortal(modal, document.body);
}
