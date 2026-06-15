'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import ModalAction from '@/components/ui/ModalAction';
import Button from '@/components/ui/Button';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';
import { encryptActionButtonPassword } from '@/lib/security/actionButtonCrypto';

export interface PlatformCredential {
  login?: string;
  password?: string;
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
  onClearCredentials?: () => Promise<void>;
  canEdit: boolean;
  canViewPassword: boolean;
}

export default function PlatformCredentialModal({
  isOpen,
  onClose,
  platform,
  credentials,
  onSave,
  onRemovePlatform,
  onClearCredentials,
  canEdit,
  canViewPassword,
}: PlatformCredentialModalProps) {
  const light = useInspectorLight();
  const [login, setLogin] = useState(credentials.login || '');
  const [password, setPassword] = useState(credentials.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const encryptedPassword = password ? encryptActionButtonPassword(password) : '';
      await onSave({ login: login || undefined, password: encryptedPassword || undefined });
      onClose();
    } catch {
      alert('Failed to save credentials.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 1500);
    } catch {
      alert('Could not copy to clipboard.');
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

  const handleClearCredentials = async () => {
    if (!onClearCredentials) return;
    if (!confirm('Are you sure you want to clear the credentials?')) return;
    setSaving(true);
    try {
      await onClearCredentials();
      onClose();
    } catch {
      alert('Failed to clear credentials.');
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
              className={`text-xs text-blue-600 hover:underline dark:text-blue-400 truncate block`}
            >
              {platform.url}
            </a>
          </div>
        </div>

        {canEdit ? (
          <div className="space-y-3">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${lightSurface(
                'text-gray-700',
                'dark:text-gray-300',
                light
              )}`}>
                Login / Username
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Enter login or username"
                disabled={saving}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${lightSurface(
                  'border-gray-200 bg-white text-gray-900',
                  'dark:border-gray-600 dark:bg-gray-700 dark:text-white',
                  light
                )}`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${lightSurface(
                'text-gray-700',
                'dark:text-gray-300',
                light
              )}`}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={saving}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm ${lightSurface(
                    'border-gray-200 bg-white text-gray-900',
                    'dark:border-gray-600 dark:bg-gray-700 dark:text-white',
                    light
                  )}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={saving}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${lightSurface(
                    'hover:bg-gray-100',
                    'dark:hover:bg-gray-600',
                    light
                  )}`}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {credentials.login && (
              <div>
                <label className={`block text-xs font-medium mb-1 ${lightSurface(
                  'text-gray-500',
                  'dark:text-gray-400',
                  light
                )}`}>
                  Login / Username
                </label>
                <p className={`text-sm ${lightSurface('text-gray-900', 'dark:text-white', light)}`}>
                  {credentials.login}
                </p>
              </div>
            )}
            {canViewPassword && credentials.password && (
              <div>
                <label className={`block text-xs font-medium mb-1 ${lightSurface(
                  'text-gray-500',
                  'dark:text-gray-400',
                  light
                )}`}>
                  Password
                </label>
                <p className={`text-sm ${lightSurface('text-gray-900', 'dark:text-white', light)}`}>
                  {showPassword ? password : '••••••••'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`text-xs text-blue-600 hover:underline dark:text-blue-400 mt-1`}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            )}
          </div>
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
          {canViewPassword && credentials.password && (
            <ModalAction
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
              label={copyFeedback ? 'Copied' : 'Copy Password'}
              onClick={handleCopyPassword}
            />
          )}
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
          {canEdit && onClearCredentials && (credentials.login || credentials.password) && (
            <ModalAction
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
              }
              label="Clear Credentials"
              onClick={handleClearCredentials}
            />
          )}
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
