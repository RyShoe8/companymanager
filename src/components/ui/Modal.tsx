'use client';

import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  headerActions?: React.ReactNode;
  hideCloseButton?: boolean;
  /** Use higher z-index so this modal appears above other overlays (e.g. when opened from another modal). */
  elevated?: boolean;
  /** Above toast / voice overlays (z-[100]). */
  stackAboveOverlays?: boolean;
  /** Above image preview lightbox (z-[110]). */
  stackAboveLightbox?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '2xl',
  headerActions,
  hideCloseButton = false,
  elevated = false,
  stackAboveOverlays = false,
  stackAboveLightbox = false,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const zClass = stackAboveLightbox
    ? 'z-[120]'
    : stackAboveOverlays
      ? 'z-[110]'
      : elevated
        ? 'z-[70]'
        : 'z-50';

  if (maxWidth === 'full') {
    // Full-screen modal that stretches from navbar to bottom
    return (
      <div
        className={`fixed inset-x-0 top-16 bottom-0 ${zClass} bg-black bg-opacity-50`}
        onClick={onClose}
        style={{ top: '4rem', height: 'calc(100vh - 4rem)' }}
      >
        <div
          className="bg-background-card shadow-xl w-full h-full rounded-t-lg overflow-hidden flex flex-col max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-semibold text-text-primary">{title}</h2>
              <div className="flex items-center gap-2">
                {headerActions}
                {!hideCloseButton && (
                  <button
                    onClick={onClose}
                    className="text-text-secondary hover:text-text-primary transition-colors p-1 -mr-1"
                    aria-label="Close"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
        </div>
      </div>
    );
  }

  // Regular centered modal
  return (
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black bg-opacity-50`}
      onClick={onClose}
    >
      <div
        className={`bg-background-card shadow-xl w-full mx-2 sm:mx-4 max-h-[90vh] rounded-lg overflow-hidden flex flex-col ${
          maxWidth === 'sm' ? 'max-w-sm' :
          maxWidth === 'md' ? 'max-w-md' :
          maxWidth === 'lg' ? 'max-w-lg' :
          maxWidth === 'xl' ? 'max-w-xl' :
          maxWidth === '2xl' ? 'max-w-2xl' :
          maxWidth === '4xl' ? 'max-w-4xl' :
          'max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border flex-shrink-0">
            <h2 className="text-lg sm:text-xl font-semibold text-text-primary">{title}</h2>
            <div className="flex items-center gap-2">
              {headerActions}
              {!hideCloseButton && (
                <button
                  onClick={onClose}
                  className="text-text-secondary hover:text-text-primary transition-colors p-1 -mr-1"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-4 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
