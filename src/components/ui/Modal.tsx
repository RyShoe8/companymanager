'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InspectorLightProvider } from '@/contexts/InspectorLightContext';
import { lockPageScroll, unlockPageScroll } from '@/lib/ui/scrollLock';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
  headerActions?: React.ReactNode;
  hideCloseButton?: boolean;
  /** Use higher z-index so this modal appears above other overlays (e.g. when opened from another modal). */
  elevated?: boolean;
  /** Above toast / voice overlays (z-[100]). */
  stackAboveOverlays?: boolean;
  /** Above image preview lightbox (z-[110]). */
  stackAboveLightbox?: boolean;
  /** When false, body padding is omitted (content supplies its own). */
  bodyPadding?: boolean;
}

const maxWidthClass = (maxWidth: ModalProps['maxWidth']) => {
  switch (maxWidth) {
    case 'sm':
      return 'max-w-sm';
    case 'md':
      return 'max-w-md';
    case 'lg':
      return 'max-w-lg';
    case 'xl':
      return 'max-w-xl';
    case '3xl':
      return 'max-w-3xl';
    case '4xl':
      return 'max-w-4xl';
    case '5xl':
      return 'max-w-5xl';
    case '6xl':
      return 'max-w-6xl';
    case '2xl':
    default:
      return 'max-w-2xl';
  }
};

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="text-text-secondary hover:text-text-primary transition-colors p-1 -mr-1"
      aria-label="Close"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
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
  bodyPadding = true,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const scrollLocked = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (!scrollLocked.current) {
        lockPageScroll();
        scrollLocked.current = true;
      }
    } else if (scrollLocked.current) {
      unlockPageScroll();
      scrollLocked.current = false;
    }
    return () => {
      if (scrollLocked.current) {
        unlockPageScroll();
        scrollLocked.current = false;
      }
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const zClass = stackAboveLightbox
    ? 'z-[120]'
    : stackAboveOverlays
      ? 'z-[110]'
      : elevated
        ? 'z-[70]'
        : 'z-50';

  const panelClass =
    'inspector-light bg-background-card border border-border shadow-xl overflow-hidden flex flex-col animate-fade-in animate-in slide-in-from-bottom-2 duration-200 ease-out';

  const header = title ? (
    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border flex-shrink-0">
      <h2 className="text-lg sm:text-xl font-semibold text-text-primary">{title}</h2>
      <div className="flex items-center gap-2">
        {headerActions}
        {!hideCloseButton && <CloseButton onClose={onClose} />}
      </div>
    </div>
  ) : null;

  const bodyClass = bodyPadding
    ? 'inspector-light flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6'
    : 'inspector-light flex-1 min-h-0 overflow-y-auto overscroll-contain';

  const content =
    maxWidth === 'full' ? (
      <div
        className={`fixed inset-x-0 top-16 bottom-0 ${zClass} bg-black/50 animate-fade-in`}
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
        style={{ top: '4rem', height: 'calc(100dvh - 4rem)' }}
      >
        <div
          className={`${panelClass} w-full h-full rounded-t-lg max-w-full`}
          onClick={(e) => e.stopPropagation()}
        >
          {header}
          <div className="inspector-light flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
        </div>
      </div>
    ) : (
      <div
        className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/50 p-2 sm:p-4 animate-fade-in`}
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
      >
        <div
          className={`${panelClass} w-full mx-auto max-h-[90vh] rounded-lg ${maxWidthClass(maxWidth)}`}
          onClick={(e) => e.stopPropagation()}
        >
          {header}
          <div className={bodyClass}>{children}</div>
        </div>
      </div>
    );

  return createPortal(
    <InspectorLightProvider>{content}</InspectorLightProvider>,
    document.body
  );
}
