'use client';

import { useState, useEffect, ReactNode, useRef } from 'react';
import { createPortal } from 'react-dom';

// Track how many BottomSheets are open to manage body overflow correctly
let openBottomSheetCount = 0;

interface BottomSheetProps { isOpen: boolean; onClose: () => void; title?: string; children: ReactNode; showHandle?: boolean; maxHeight?: string; hideCloseButton?: boolean; /** Use higher z-index so this sheet appears above other overlays. */ elevated?: boolean; }

export default function BottomSheet({ isOpen, onClose, title, children, showHandle = true, maxHeight = '80vh', hideCloseButton = false, elevated = false }: BottomSheetProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [mounted, setMounted] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => { setMounted(true); }, []);
  
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      // Opening
      openBottomSheetCount++;
      wasOpen.current = true;
      setShouldRender(true);
      document.body.style.overflow = 'hidden';
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
          document.body.style.overflow = '';
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
          document.body.style.overflow = '';
        }
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => { setStartY(e.touches[0].clientY); setIsDragging(true); };
  const handleTouchMove = (e: React.TouchEvent) => { if (!isDragging) return; const diff = e.touches[0].clientY - startY; if (diff > 0) setDragOffset(diff); };
  const handleTouchEnd = () => { setIsDragging(false); if (dragOffset > 100) onClose(); setDragOffset(0); };
  const handleBackdropClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  if (!mounted || !shouldRender) return null;

  const zClass = elevated ? 'z-[60]' : 'z-50';
  return createPortal(
    <div 
      className={`fixed inset-0 ${zClass} flex items-end justify-center transition-colors duration-300 ${isOpen ? 'bg-black/50' : 'bg-transparent pointer-events-none'}`} 
      onClick={isOpen ? handleBackdropClick : undefined}
    >
      <div 
        className={`w-full bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${isOpen && dragOffset === 0 ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight, transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined }}
      >
        {showHandle && <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}><div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" /></div>}
        {title && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            {!hideCloseButton && (
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 -mr-1" aria-label="Close">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 60px)` }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

interface QuickActionProps { icon: ReactNode; label: string; onClick: () => void; variant?: 'default' | 'danger' | 'success' | 'warning'; disabled?: boolean; }
export function QuickAction({ icon, label, onClick, variant = 'default', disabled = false }: QuickActionProps) {
  const variantClasses = { default: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700', danger: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20', success: 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20', warning: 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' };
  return (<button onClick={onClick} disabled={disabled} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <span className="w-5 h-5 flex items-center justify-center">{icon}</span><span className="font-medium">{label}</span>
  </button>);
}
