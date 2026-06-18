'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

type ClientLogoSize = 'sm' | 'md' | 'lg';

interface ClientLogoProps {
  clientId: string;
  logo?: string;
  color?: string;
  name?: string;
  isManagerOrAdmin: boolean;
  size?: ClientLogoSize;
  onLogoUpdate: (logoUrl: string | undefined) => void;
}

const SIZE_CLASSES: Record<ClientLogoSize, string> = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
};

const SIZE_PX: Record<ClientLogoSize, number> = {
  sm: 40,
  md: 48,
  lg: 80,
};

export default function ClientLogo({
  clientId,
  logo,
  color = '#3b82f6',
  name,
  isManagerOrAdmin,
  size = 'md',
  onLogoUpdate,
}: ClientLogoProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const logoSize = SIZE_CLASSES[size];
  const logoSizePx = SIZE_PX[size];
  const fallbackLetter = name?.charAt(0).toUpperCase() ?? '?';

  const handleDownload = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!logo) return;
    const link = document.createElement('a');
    link.href = logo;
    link.download = `client-${clientId}-logo${logo.substring(logo.lastIndexOf('.'))}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogoClick = () => {
    if (!isManagerOrAdmin) {
      handleDownload();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (logo) handleDownload(e);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('File must be an image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/clients/${clientId}/logo`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload logo');
      }
      const data = await response.json();
      onLogoUpdate(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this logo?')) return;

    try {
      const response = await fetch(`/api/clients/${clientId}/logo`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete logo');
      onLogoUpdate(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete logo');
    }
  };

  return (
    <div className="relative flex-shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={!isManagerOrAdmin || isUploading}
      />

      <div
        onClick={handleLogoClick}
        onContextMenu={handleRightClick}
        className={`${logoSize} rounded-lg border-2 border-border flex items-center justify-center overflow-hidden cursor-pointer transition-all hover:border-primary/50 relative group ${
          isManagerOrAdmin ? 'hover:shadow-md' : ''
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={!logo ? { backgroundColor: color } : {}}
        title={
          isManagerOrAdmin
            ? logo
              ? 'Click to change logo, right-click to download'
              : 'Click to upload logo'
            : logo
              ? 'Click to download logo'
              : 'No logo'
        }
      >
        {logo ? (
          <Image
            key={logo}
            src={logo}
            alt={`${name ?? 'Client'} logo`}
            width={logoSizePx}
            height={logoSizePx}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <div className="text-white text-sm font-bold flex items-center justify-center w-full h-full">
            {isManagerOrAdmin ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            ) : (
              fallbackLetter
            )}
          </div>
        )}

        {logo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(e);
            }}
            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg"
            aria-label="Download logo"
            title="Download logo"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        )}
      </div>

      {isManagerOrAdmin && logo && (
        <button
          type="button"
          onClick={handleDelete}
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors text-xs z-10"
          aria-label="Delete logo"
          title="Delete logo"
        >
          ×
        </button>
      )}

      {error && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-500 whitespace-nowrap z-10 bg-background-elevated px-2 py-1 rounded shadow border border-border">
          {error}
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
