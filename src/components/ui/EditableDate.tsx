'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { formatCalendarDateUTC, parseIsoDateOnlyToUtc, toIsoDateInputValueUTC } from '@/lib/utils/dateUtils';

interface EditableDateProps {
  value: Date | string | null;
  onSave: (value: Date | null) => void | Promise<void>;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showTime?: boolean;
  /** When true, clearing the input calls onSave(null). */
  clearable?: boolean;
  /** When true and value is unset, render nothing until editing. */
  hideWhenEmpty?: boolean;
  /** Open the editor on mount (e.g. after clicking an external label). */
  startInEditMode?: boolean;
  /** Called when editing closes (save, blur, or Escape). */
  onEditEnd?: () => void;
}

export default function EditableDate({
  value, onSave, className = '', placeholder = 'Set date', disabled = false, showTime = false, clearable = false,
  hideWhenEmpty = false, startInEditMode = false, onEditEnd,
}: EditableDateProps) {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      if (showTime) {
        const date = new Date(value);
        setEditValue(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
      } else {
        setEditValue(toIsoDateInputValueUTC(value));
      }
    } else {
      setEditValue('');
    }
  }, [value, showTime]);

  useEffect(() => {
    if (startInEditMode) setIsEditing(true);
  }, [startInEditMode]);
  useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);

  const closeEditing = useCallback(() => {
    setIsEditing(false);
    onEditEnd?.();
  }, [onEditEnd]);

  const handleSave = async () => {
    if (!editValue) {
      if (clearable) await onSave(null);
      closeEditing();
      return;
    }
    if (showTime) {
      const newDate = new Date(editValue);
      if (!isNaN(newDate.getTime())) await onSave(newDate);
    } else {
      const utc = parseIsoDateOnlyToUtc(editValue);
      if (utc) await onSave(utc);
    }
    closeEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    else if (e.key === 'Escape') closeEditing();
  };

  const getDisplayValue = () => {
    if (!value) return null;
    const date = new Date(value);
    return showTime
      ? date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : formatCalendarDateUTC(date);
  };

  const isEmpty = !value;

  if (disabled) {
    if (hideWhenEmpty && isEmpty) return null;
    return <span className={className}>{getDisplayValue() || placeholder}</span>;
  }

  if (isEditing) {
    return (
      <input ref={inputRef} type={showTime ? 'datetime-local' : 'date'} value={editValue} onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave} onKeyDown={handleKeyDown}
        className={`${className} border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`} />
    );
  }

  if (hideWhenEmpty && isEmpty) return null;

  return (
    <span onClick={() => setIsEditing(true)}
      className={`${className} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 py-0.5 transition-colors inline-flex items-center gap-1 ${!value ? 'text-gray-400 italic' : ''}`}>
      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      {getDisplayValue() || placeholder}
    </span>
  );
}
