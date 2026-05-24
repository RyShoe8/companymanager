'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';
import { downloadImage } from '@/lib/downloadImage';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string | null;
  title?: string;
}

export default function ImagePreviewModal({ isOpen, onClose, src, title = 'Screenshot' }: ImagePreviewModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  const handleSave = () => {
    downloadImage(src, title);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />

      <div className="relative z-10 flex items-center justify-between px-4 py-3 shrink-0">
        <p className="text-sm font-medium text-white truncate max-w-[calc(100vw-8rem)]">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors p-1"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 min-h-0 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title}
          className="max-h-[calc(100vh-8rem)] max-w-[min(100vw-2rem,100%)] object-contain pointer-events-auto"
        />
      </div>

      <div className="relative z-10 flex justify-center gap-3 px-4 py-4 shrink-0">
        <Button type="button" variant="secondary" onClick={handleSave} className="min-h-0">
          Save
        </Button>
        <Button type="button" onClick={onClose} className="min-h-0">
          Close
        </Button>
      </div>
    </div>
  );
}
