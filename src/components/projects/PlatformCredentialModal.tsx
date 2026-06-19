'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import ModalAction from '@/components/ui/ModalAction';
import Button from '@/components/ui/Button';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

export interface PlatformCredential {
  login?: string;
}

/** Merge saved login onto a stack/social item, clearing when empty. */
export function applyPlatformCredentials<T extends PlatformCredential>(
  item: T,
  credentials: PlatformCredential
): T {
  const login = credentials.login?.trim();
  const next = { ...item };
  if (login) next.login = login;
  else delete next.login;
  return next;
}

export interface PlatformInfo {
  name: string;
  icon: React.ReactNode;
  url: string;
}

interface PlatformCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: PlatformInfo;
  credentials: PlatformCredential;
  onSave: (credentials: PlatformCredential) => Promise<void>;
  onRemovePlatform?: () => Promise<void>;
  canEdit: boolean;
}

export default function PlatformCredentialModal({
  isOpen,
  onClose,
  platform,
  credentials,
  onSave,
  onRemovePlatform,
  canEdit,
}: PlatformCredentialModalProps) {
  const light = useInspectorLight();
  const [login, setLogin] = useState('');
  const [saving, setSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [blockAutofill, setBlockAutofill] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setLogin('');
      setCopyFeedback(false);
      setBlockAutofill(true);
      return;
    }
    const savedLogin = credentials.login?.trim() || '';
    setLogin(savedLogin);
    setCopyFeedback(false);
    setBlockAutofill(!savedLogin);
  }, [isOpen, platform.name, credentials.login]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        login: login.trim() || undefined,
      });
      onClose();
    } catch {
      alert('Failed to save login.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(platform.url);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 1500);
    } catch {
      alert('Could not copy to clipboard.');
    }
  };

  const handleRemovePlatform = async () => {
    if (!onRemovePlatform) return;
    if (!confirm('Are you sure you want to remove this platform from the project?')) return;
    setSaving(true);
    try {
      await onRemovePlatform();
      onClose();
    } catch {
      alert('Failed to remove platform.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={platform.name}
      maxWidth="sm"
      elevated
      stackAboveOverlays
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b">
          <div className="flex-shrink-0">{platform.icon}</div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${lightSurface('text-gray-900', 'dark:text-white', light)}`}>
              {platform.name}
            </p>
            <a
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline dark:text-blue-400 truncate block"
            >
              {platform.url}
            </a>
          </div>
        </div>

        {canEdit ? (
          <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="space-y-3">
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${lightSurface(
                  'text-gray-700',
                  'dark:text-gray-300',
                  light
                )}`}
              >
                Login / Username
              </label>
              <input
                type="text"
                name="platform-credential-login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                onFocus={() => setBlockAutofill(false)}
                placeholder="Enter login or username"
                autoComplete="off"
                readOnly={blockAutofill}
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                disabled={saving}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${lightSurface(
                  'border-gray-200 bg-white text-gray-900',
                  'dark:border-gray-600 dark:bg-gray-700 dark:text-white',
                  light
                )}`}
              />
            </div>
          </form>
        ) : (
          credentials.login && (
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${lightSurface(
                  'text-gray-500',
                  'dark:text-gray-400',
                  light
                )}`}
              >
                Login / Username
              </label>
              <p className={`text-sm ${lightSurface('text-gray-900', 'dark:text-white', light)}`}>
                {credentials.login}
              </p>
            </div>
          )
        )}

        <div className="pt-3 border-t flex flex-wrap gap-2">
          <ModalAction
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            }
            label="Open URL"
            onClick={() => {
              window.open(platform.url, '_blank', 'noopener,noreferrer');
            }}
          />
          <ModalAction
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
            label={copyFeedback ? 'Copied' : 'Copy URL'}
            onClick={handleCopyUrl}
          />
          {canEdit && onRemovePlatform && (
            <ModalAction
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              }
              label="Remove Platform"
              variant="danger"
              onClick={handleRemovePlatform}
            />
          )}
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
