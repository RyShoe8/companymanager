'use client';

import type React from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import SocialIcon from '@/components/projects/SocialIcon';
import ScreenshotToolPanel from '@/components/shared/ScreenshotToolPanel';
import RecordingToolPanel from '@/components/shared/RecordingToolPanel';
import { detectSocialNetwork, SOCIAL_NETWORK_LABELS } from '@/lib/utils/socialUrls';
import { useCategoryModalState, type AddStep } from '@/hooks/checklist/useCategoryModalState';
import type {
  AddSmartButtonPayload,
  PendingAssetPayload,
  AssetLinkContext,
} from '@/components/checklist/categoryModalTypes';

export type {
  AddSmartButtonPayload,
  PendingAssetPayload,
  AssetLinkContext,
} from '@/components/checklist/categoryModalTypes';

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
  const {
    step,
    setStep,
    addLabel,
    setAddLabel,
    addUrl,
    setAddUrl,
    adding,
    docName,
    setDocName,
    docContent,
    setDocContent,
    savingDoc,
    emailAddr,
    setEmailAddr,
    emailLabel,
    setEmailLabel,
    addingEmail,
    socialUrl,
    setSocialUrl,
    addingSocial,
    googleName,
    setGoogleName,
    googleBusy,
    uploadFileInput,
    setUploadFileInput,
    googleWorkspace,
    defaultMediaTarget,
    screenshotTarget,
    isEntityContext,
    useAssetFlow,
    entitySubmitLabel,
    handleAddSubmit,
    handleEmailSubmit,
    handleNoteSubmit,
    handleGoogleDocSubmit,
    handleGoogleSheetSubmit,
    handleAttachFromDrive,
    handleUploadToDrive,
    handleSocialSubmit,
  } = useCategoryModalState({
    projectId,
    clientId,
    onClose,
    onAddButton,
    onDocumentCreated,
    linkContext,
    mode,
    onPendingAsset,
    onAddSocial,
  });

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
