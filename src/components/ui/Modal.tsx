'use client';

import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  headerActions?: React.ReactNode;
  hideCloseButton?: boolean;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = '2xl', headerActions, hideCloseButton = false }: ModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className={`bg-background-card rounded-lg shadow-xl w-full mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto ${
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
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
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
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
