'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

interface SwipeAction { label: string; icon?: ReactNode; color: string; textColor?: string; onClick: () => void; }
interface SwipeableCardProps { children: ReactNode; leftActions?: SwipeAction[]; rightActions?: SwipeAction[]; className?: string; threshold?: number; }

export default function SwipeableCard({ children, leftActions = [], rightActions = [], className = '', threshold = 80 }: SwipeableCardProps) {
  const light = useInspectorLight();
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [showActions, setShowActions] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const actionWidth = 80;
  const maxLeftOffset = leftActions.length * actionWidth;
  const maxRightOffset = rightActions.length * actionWidth;

  const handleTouchStart = (e: React.TouchEvent) => { setStartX(e.touches[0].clientX); setIsDragging(true); };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX;
    setOffset(diff > 0 ? Math.min(diff, maxLeftOffset + 20) : Math.max(diff, -(maxRightOffset + 20)));
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
    if (offset > threshold && leftActions.length > 0) { setOffset(maxLeftOffset); setShowActions('left'); }
    else if (offset < -threshold && rightActions.length > 0) { setOffset(-maxRightOffset); setShowActions('right'); }
    else { setOffset(0); setShowActions(null); }
  };
  const resetPosition = () => { setOffset(0); setShowActions(null); };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) resetPosition(); };
    if (showActions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  const handleActionClick = (action: SwipeAction) => { action.onClick(); resetPosition(); };

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {leftActions.length > 0 && <div className="absolute left-0 top-0 bottom-0 flex items-stretch" style={{ width: maxLeftOffset }}>
        {leftActions.map((action, idx) => <button key={idx} onClick={() => handleActionClick(action)} className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium" style={{ backgroundColor: action.color, color: action.textColor || 'white' }}>{action.icon}{action.label}</button>)}
      </div>}
      {rightActions.length > 0 && <div className="absolute right-0 top-0 bottom-0 flex items-stretch" style={{ width: maxRightOffset }}>
        {rightActions.map((action, idx) => <button key={idx} onClick={() => handleActionClick(action)} className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium" style={{ backgroundColor: action.color, color: action.textColor || 'white' }}>{action.icon}{action.label}</button>)}
      </div>}
      <div className={`relative ${lightSurface('bg-white', 'dark:bg-gray-800', light)} transition-transform ${isDragging ? '' : 'duration-200'}`} style={{ transform: `translateX(${offset}px)` }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>{children}</div>
    </div>
  );
}
