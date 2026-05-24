'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Option { value: string; label: string; color?: string; }

interface EditableSelectProps {
  value: string;
  options: Option[];
  onSave: (value: string) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  showColorDot?: boolean;
}

function classNameHasTextColor(className: string): boolean {
  return /\btext-/.test(className);
}

export default function EditableSelect({ value, options, onSave, className = '', disabled = false, showColorDot = false }: EditableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentOption = options.find(opt => opt.value === value);
  const defaultTextClass = classNameHasTextColor(className) ? '' : 'text-gray-900';

  useEffect(() => { setMounted(true); }, []);

  /** `position:fixed` is viewport-relative — do not add scrollY/scrollX (breaks inside scrolled inspector). */
  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 120),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onScrollOrResize = () => updateDropdownPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = async (optionValue: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (optionValue !== value) await onSave(optionValue);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(true); } return; }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1)); break;
      case 'ArrowUp': e.preventDefault(); setHighlightedIndex(prev => Math.max(prev - 1, 0)); break;
      case 'Enter': e.preventDefault(); if (highlightedIndex >= 0) handleSelect(options[highlightedIndex].value, e as any); break;
      case 'Escape': setIsOpen(false); break;
    }
  };

  if (disabled) {
    return (<span className={`${className} ${defaultTextClass} flex items-center gap-1.5`}>
      {showColorDot && currentOption?.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentOption.color }} />}
      {currentOption?.label || value}
    </span>);
  }

  const dropdown = isOpen && mounted ? createPortal(
    <div 
      ref={dropdownRef}
      className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 rounded-lg shadow-lg py-1 max-h-48 overflow-auto"
      style={{ top: dropdownPosition.top, left: dropdownPosition.left, minWidth: dropdownPosition.width }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {options.map((option, idx) => (
        <button key={option.value} type="button" onClick={() => handleSelect(option.value)} onMouseEnter={() => setHighlightedIndex(idx)}
          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors text-gray-900 ${idx === highlightedIndex ? 'bg-blue-50 dark:bg-blue-900/30' : ''} ${option.value === value ? 'bg-blue-100 dark:bg-blue-900/50 font-medium' : ''}`}>
          {showColorDot && option.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: option.color }} />}
          {option.label}
          {option.value === value && <svg className="w-4 h-4 ml-auto text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative inline-block">
      <button ref={buttonRef} type="button" onClick={handleButtonClick} onKeyDown={handleKeyDown}
        className={`${className} ${defaultTextClass} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors flex items-center gap-1.5 text-left`}>
        {showColorDot && currentOption?.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentOption.color }} />}
        <span>{currentOption?.label || value}</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
