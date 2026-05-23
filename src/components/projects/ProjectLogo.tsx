'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import useIsMobile from '@/lib/hooks/useIsMobile';
import Button from '@/components/ui/Button';

interface ProjectLogoProps {
  projectId: string;
  logo?: string;
  color?: string;
  isManagerOrAdmin: boolean;
  onLogoUpdate: (logoUrl: string | undefined) => void;
}

export default function ProjectLogo({ projectId, logo, color = '#3b82f6', isManagerOrAdmin, onLogoUpdate }: ProjectLogoProps) {
  const isMobile = useIsMobile();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (logo) {
      const link = document.createElement('a');
      link.href = logo;
      link.download = `project-${projectId}-logo${logo.substring(logo.lastIndexOf('.'))}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleLogoClick = () => {
    if (!isManagerOrAdmin) {
      // If not admin, allow download
      handleDownload();
      return;
    }

    // If admin, open file picker to upload/change
    fileInputRef.current?.click();
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (logo) {
      handleDownload(e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('File must be an image');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/projects/${projectId}/logo`, {
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
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this logo?')) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/logo`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete logo');
      }

      onLogoUpdate(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete logo');
    }
  };

  const logoSize = isMobile ? 'w-16 h-16' : 'w-20 h-20';
  const logoSizePx = isMobile ? 64 : 80;

  return (
    <div className="relative">
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
        className={`${logoSize} rounded-lg border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden cursor-pointer transition-all hover:border-blue-500 dark:hover:border-blue-400 relative group ${
          isManagerOrAdmin ? 'hover:shadow-md' : ''
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={!logo ? { backgroundColor: color } : {}}
        title={isManagerOrAdmin ? (logo ? 'Click to change logo, right-click to download' : 'Click to upload logo') : (logo ? 'Click to download logo' : 'No logo')}
      >
        {logo ? (
          <Image
            key={logo}
            src={logo}
            alt="Project logo"
            width={logoSizePx}
            height={logoSizePx}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <div className="text-white text-xs font-semibold flex items-center justify-center w-full h-full">
            {isManagerOrAdmin ? (
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs sm:text-sm font-bold">
                {color ? '🎨' : '📁'}
              </div>
            )}
          </div>
        )}
        
        {/* Download button overlay - visible on hover when logo exists */}
        {logo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(e);
            }}
            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg"
            aria-label="Download logo"
            title="Download logo"
          >
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        )}
      </div>

      {isManagerOrAdmin && logo && (
        <button
          onClick={handleDelete}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors text-xs z-10"
          aria-label="Delete logo"
          title="Delete logo"
        >
          ×
        </button>
      )}

      {error && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-500 whitespace-nowrap z-10 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow">
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
