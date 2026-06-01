'use client';

import { useState, useEffect, ReactNode, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';

// Track how many BottomSheets are open to manage page overflow correctly
let openBottomSheetCount = 0;

function lockPageScroll() {
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
}

function unlockPageScroll() {
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showHandle?: boolean;
  maxHeight?: string;
  hideCloseButton?: boolean;
  /** Use higher z-index so this sheet appears above other overlays. */
  elevated?: boolean;
  /** Above parent modal / lightbox (z-[120]). */
  stackAboveLightbox?: boolean;
  /** `card` = filled panel; `chrome` = transparent shell (content supplies its own surface). */
  surface?: 'card' | 'chrome';
  sheetClassName?: string;
  /** Optional ref to the inner scrollable region (for inspector deep-link scrolling). */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  /** `centeredInspector` adds left/right dismiss regions beside a centered panel. */
  layout?: 'bottomSheet' | 'centeredInspector';
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  showHandle = true,
  maxHeight = '80vh',
  hideCloseButton = false,
  elevated = false,
  stackAboveLightbox = false,
  surface = 'card',
  sheetClassName = '',
  scrollContainerRef,
  layout = 'bottomSheet',
}: BottomSheetProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [mounted, setMounted] = useState(false);
  const wasOpen = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);
  
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      // Opening
      openBottomSheetCount++;
      wasOpen.current = true;
      setShouldRender(true);
      lockPageScroll();
    } else if (!isOpen && wasOpen.current) {
      // Closing - use timeout to allow animation to complete, then unmount
      openBottomSheetCount--;
      wasOpen.current = false;
      if (openBottomSheetCount <= 0) {
        openBottomSheetCount = 0;
      }
      // Wait for close animation then unmount
      const timer = setTimeout(() => {
        setShouldRender(false);
        if (openBottomSheetCount <= 0) {
          unlockPageScroll();
        }
      }, 350); // Slightly longer than 300ms transition
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wasOpen.current) {
        openBottomSheetCount = Math.max(0, openBottomSheetCount - 1);
        wasOpen.current = false;
        if (openBottomSheetCount <= 0) {
          unlockPageScroll();
        }
      }
    };
  }, []);

  const handleSheetWheel = (e: React.WheelEvent) => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    if (scrollEl.contains(e.target as Node)) return;
    e.preventDefault();
    scrollEl.scrollTop += e.deltaY;
  };

  const handleBackdropWheel = (e: React.WheelEvent) => {
    if (e.target === e.currentTarget) e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => { setStartY(e.touches[0].clientY); setIsDragging(true); };
  const handleTouchMove = (e: React.TouchEvent) => { if (!isDragging) return; const diff = e.touches[0].clientY - startY; if (diff > 0) setDragOffset(diff); };
  const handleTouchEnd = () => { setIsDragging(false); if (dragOffset > 100) onClose(); setDragOffset(0); };
  const handleBackdropClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  if (!mounted || !shouldRender) return null;

  const zClass = stackAboveLightbox ? 'z-[120]' : elevated ? 'z-[60]' : 'z-50';
  const surfaceClass =
    surface === 'chrome'
      ? 'bg-transparent shadow-none'
      : 'bg-background-card rounded-t-2xl shadow-2xl';

  const sheetBody = (
    <>
      {showHandle && (
        <div
          className="flex-shrink-0 flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
      )}
      {title && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          {!hideCloseButton && (
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary p-1 -mr-1 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
      <div
        ref={(node) => {
          scrollRef.current = node;
          if (scrollContainerRef) scrollContainerRef.current = node;
        }}
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain"
      >
        {children}
      </div>
    </>
  );

  if (layout === 'centeredInspector') {
    return createPortal(
      <div
        className={`fixed inset-0 ${zClass} flex flex-col transition-colors duration-300 overscroll-y-contain ${isOpen ? 'bg-black/50' : 'bg-transparent pointer-events-none'}`}
        onClick={isOpen ? handleBackdropClick : undefined}
        onWheel={isOpen ? handleBackdropWheel : undefined}
      >
        <button
          type="button"
          className="flex-1 min-h-0 w-full cursor-default"
          aria-label="Close inspector"
          onClick={onClose}
        />
        <div
          className={`flex flex-shrink-0 w-full items-end transition-transform duration-300 ease-out ${isOpen && dragOffset === 0 ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined }}
        >
          <button
            type="button"
            className="hidden sm:block flex-1 self-stretch min-h-[12rem] cursor-default"
            aria-label="Close inspector"
            onClick={onClose}
          />
          <div
            className={`w-full max-w-[min(120rem,100%)] flex flex-col min-h-0 ${surfaceClass} ${sheetClassName}`}
            style={{ maxHeight }}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleSheetWheel}
          >
            {sheetBody}
          </div>
          <button
            type="button"
            className="hidden sm:block flex-1 self-stretch min-h-[12rem] cursor-default"
            aria-label="Close inspector"
            onClick={onClose}
          />
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 ${zClass} flex items-end justify-center transition-colors duration-300 overscroll-y-contain ${isOpen ? 'bg-black/50' : 'bg-transparent pointer-events-none'}`}
      onClick={isOpen ? handleBackdropClick : undefined}
      onWheel={isOpen ? handleBackdropWheel : undefined}
    >
      <div
        className={`w-full transition-transform duration-300 ease-out flex flex-col ${surfaceClass} ${sheetClassName} ${isOpen && dragOffset === 0 ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight, transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined }}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleSheetWheel}
      >
        {sheetBody}
      </div>
    </div>,
    document.body
  );
}

interface QuickActionProps { icon: ReactNode; label: string; onClick: () => void; variant?: 'default' | 'danger' | 'success' | 'warning'; disabled?: boolean; }
export function QuickAction({ icon, label, onClick, variant = 'default', disabled = false }: QuickActionProps) {
  const variantClasses = { default: 'text-text-primary hover:bg-background-elevated', danger: 'text-error hover:bg-error-light', success: 'text-success hover:bg-success-light', warning: 'text-warning hover:bg-warning-light' };
  return (<button onClick={onClick} disabled={disabled} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <span className="w-5 h-5 flex items-center justify-center">{icon}</span><span className="font-medium">{label}</span>
  </button>);
}
