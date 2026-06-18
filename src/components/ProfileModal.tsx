'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/shared/ConfirmModal';

interface ProfileModalProps {
  onUpdate: () => void;
  onClose: () => void;
}

export default function ProfileModal({ onUpdate, onClose }: ProfileModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [profilePictureError, setProfilePictureError] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);

  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setName(data.name || '');
            setEmail(data.email || '');
            setProfilePicture(data.profilePicture || null);
            setProfilePictureError(false);
            setHasPassword(!!data.hasPassword);
          }
        }
      } catch {
        // Error fetching profile
      }
    };
    fetchProfile();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/profile/picture', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      setProfilePicture(data.url);
      setProfilePictureError(false);
      onUpdate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      onUpdate();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('New passwords do not match');
      return;
    }
    setPasswordChanging(true);
    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    try {
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setPasswordChangeSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPasswordChange(false);
    } catch (err: unknown) {
      setPasswordChangeError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordChanging(false);
    }
  };

  const openDeleteFlow = () => {
    setDeleteError('');
    setConfirmEmail('');
    setDeletePassword('');
    setShowDeleteWarning(true);
  };

  const proceedToDeleteConfirm = () => {
    setShowDeleteWarning(false);
    setShowDeleteConfirm(true);
  };

  const canConfirmDelete =
    confirmEmail.trim().toLowerCase() === email.trim().toLowerCase() &&
    (!hasPassword || deletePassword.length > 0);

  const handleDeleteAccount = async () => {
    if (!canConfirmDelete) return;

    setDeleting(true);
    setDeleteError('');

    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmEmail: confirmEmail.trim(),
          ...(hasPassword ? { password: deletePassword } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }

      setShowDeleteConfirm(false);
      onClose();
      router.push('/login');
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const userInitials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : email?.[0]?.toUpperCase() || 'U';

  return (
    <>
      <div className="space-y-8">
        <form id="profile-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-error-light border border-error/30 text-error px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {profilePicture && !profilePictureError ? (
              <img
                src={profilePicture}
                alt={name || email}
                width={96}
                height={96}
                className="w-24 h-24 rounded-full object-cover"
                onError={() => setProfilePictureError(true)}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-medium">
                {userInitials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-2 hover:bg-primary-hover transition-colors"
              disabled={loading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <p className="text-sm text-text-secondary">Click the camera icon to upload a profile picture</p>
        </div>

        <Input
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </form>

      {hasPassword && (
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Password</h3>
            {!showPasswordChange && (
              <Button type="button" variant="secondary" onClick={() => setShowPasswordChange(true)}>
                Change Password
              </Button>
            )}
          </div>

          {passwordChangeSuccess && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm border border-green-200">
              {passwordChangeSuccess}
            </div>
          )}

          {showPasswordChange && (
            <form onSubmit={handlePasswordChange} className="space-y-5 bg-background-elevated p-5 rounded-xl border border-border">
              {passwordChangeError && (
                <div className="bg-error-light border border-error/30 text-error px-4 py-3 rounded-lg text-sm">
                  {passwordChangeError}
                </div>
              )}
              
              <Input
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <div className="space-y-1">
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                {confirmNewPassword && newPassword !== confirmNewPassword && (
                  <p className="text-xs text-error">Passwords do not match.</p>
                )}
              </div>
              <div className="flex gap-3 justify-end pt-3 border-t border-border mt-4">
                <Button type="button" variant="secondary" onClick={() => setShowPasswordChange(false)} disabled={passwordChanging}>
                  Cancel
                </Button>
                <Button type="submit" disabled={passwordChanging || (confirmNewPassword !== newPassword)}>
                  {passwordChanging ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="pt-6 mt-6 border-t border-error/20 space-y-3">
        <h3 className="text-sm font-semibold text-error">Danger zone</h3>
        <p className="text-sm text-text-secondary">
          Permanently delete your account. If you are the only member of your organization, all projects and
          organization data will be removed.
        </p>
        <Button type="button" variant="danger" onClick={openDeleteFlow} disabled={loading || deleting}>
          Delete account
        </Button>
      </div>

      <div className="flex gap-3 justify-end pt-6 mt-8 border-t border-border bg-background/50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button form="profile-form" type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
      <ConfirmModal
        isOpen={showDeleteWarning}
        title="Delete your account?"
        message={
          <p>
            This action is permanent. Your profile will be removed. If you are the only member of your
            organization, all projects, tasks, meetings, and billing data for that organization will also be
            deleted.
          </p>
        }
        confirmLabel="Continue"
        confirmVariant="danger"
        onCancel={() => setShowDeleteWarning(false)}
        onConfirm={proceedToDeleteConfirm}
        elevated
        stackAboveOverlays
      />

      <Modal
        isOpen={showDeleteConfirm}
        onClose={deleting ? () => {} : () => setShowDeleteConfirm(false)}
        title="Confirm account deletion"
        maxWidth="sm"
        elevated
        stackAboveOverlays
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Type your email address{hasPassword ? ' and password' : ''} to confirm.
          </p>

          {deleteError && (
            <div className="bg-error-light border border-error/30 text-error px-4 py-3 rounded-lg text-sm">
              {deleteError}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            autoComplete="off"
          />

          {hasPassword && (
            <Input
              label="Password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
            />
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void handleDeleteAccount()}
              disabled={!canConfirmDelete || deleting}
            >
              {deleting ? 'Deleting…' : 'Delete my account'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
