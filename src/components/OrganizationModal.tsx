'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface OrganizationModalProps {
  onUpdate: () => void;
  onClose: () => void;
}

export default function OrganizationModal({ onUpdate, onClose }: OrganizationModalProps) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const response = await fetch('/api/organization');
        if (response.ok) {
          const data = await response.json();
          setName(data.name || '');
          setDomain(data.domain || '');
          setIsAdmin(data.isAdmin || false);
        }
      } catch (error) {
        // Error fetching organization
      }
    };
    fetchOrganization();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!name.trim()) {
      setError('Organization name is required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/organization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), domain: domain.trim() || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update organization');
      }

      onUpdate();
      // Only close if not on setup page
      if (!window.location.pathname.includes('setup-organization')) {
        onClose();
        // Refresh the page to ensure all components have updated data
        window.location.reload();
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-error-light border border-error/30 text-error px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {!isAdmin && (
        <div className="bg-primary-light border border-primary/30 text-primary-dark px-4 py-3 rounded-lg">
          <p className="text-sm font-medium">View Only</p>
          <p className="text-xs mt-1">Only organization administrators can edit organization settings.</p>
        </div>
      )}

      {isAdmin ? (
        <>
          <Input
            label="Organization Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Enter your organization name"
          />
          <Input
            label="Domain (Optional)"
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
          />
          <p className="text-sm text-text-secondary">
            Your organization domain (e.g., example.com). This is optional and can be used for email invitations.
          </p>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Organization Name
            </label>
            <div className="px-3 py-2 border border-border rounded-lg bg-background-card text-text-primary">
              {name || 'Not set'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Domain <span className="text-text-secondary font-normal">(Optional)</span>
            </label>
            <div className="px-3 py-2 border border-border rounded-lg bg-background-card text-text-primary">
              {domain || 'Not set'}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 justify-end pt-4 border-t border-border">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
          {isAdmin ? 'Cancel' : 'Close'}
        </Button>
        {isAdmin && (
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>
    </form>
  );
}
