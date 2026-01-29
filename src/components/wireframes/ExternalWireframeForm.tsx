'use client';

import { useState } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface ExternalWireframeFormProps {
  projectId: string;
  onSubmit: (url: string) => Promise<void>;
  onCancel: () => void;
  existingUrl?: string;
}

export default function ExternalWireframeForm({ projectId, onSubmit, onCancel, existingUrl }: ExternalWireframeFormProps) {
  const [url, setUrl] = useState(existingUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const detectToolType = (url: string): { name: string; icon: string } | null => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('figma.com')) return { name: 'Figma', icon: '🎨' };
    if (lowerUrl.includes('miro.com')) return { name: 'Miro', icon: '🖼️' };
    if (lowerUrl.includes('whimsical.com')) return { name: 'Whimsical', icon: '📐' };
    if (lowerUrl.includes('balsamiq.com')) return { name: 'Balsamiq', icon: '✏️' };
    if (lowerUrl.includes('sketch.com')) return { name: 'Sketch', icon: '✏️' };
    if (lowerUrl.includes('invisionapp.com') || lowerUrl.includes('invision.com')) return { name: 'InVision', icon: '👁️' };
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save site structure link');
      setIsSubmitting(false);
    }
  };

  const toolInfo = url ? detectToolType(url) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          label="Site Structure URL"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://figma.com/file/..."
          error={error}
          disabled={isSubmitting}
          autoFocus
        />
        {toolInfo && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>{toolInfo.icon}</span>
            <span>Detected: {toolInfo.name}</span>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Link to your wireframe in Figma, Miro, Balsamiq, or any other tool
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting || !url.trim()}>
          {isSubmitting ? 'Saving...' : existingUrl ? 'Update Link' : 'Save Link'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
