'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface EditableNumberProps {
  value: number | null | undefined;
  onSave: (value: number) => void | Promise<void>;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
  /** When true and value is unset, render nothing until editing. */
  hideWhenEmpty?: boolean;
  /** Open the editor on mount (e.g. after clicking an external label). */
  startInEditMode?: boolean;
  /** Called when editing closes (save, blur, or Escape). */
  onEditEnd?: () => void;
}

export default function EditableNumber({
  value, onSave, className = '', placeholder = '0', disabled = false,
  min, max, step = 1, suffix = '', prefix = '',
  hideWhenEmpty = false, startInEditMode = false, onEditEnd,
}: EditableNumberProps) {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [editValue, setEditValue] = useState(value?.toString() || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditValue(value?.toString() || ''); }, [value]);
  useEffect(() => {
    if (startInEditMode) setIsEditing(true);
  }, [startInEditMode]);
  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  const closeEditing = useCallback(() => {
    setIsEditing(false);
    onEditEnd?.();
  }, [onEditEnd]);

  const handleSave = async () => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue !== value) {
      let constrainedValue = numValue;
      if (min !== undefined) constrainedValue = Math.max(min, constrainedValue);
      if (max !== undefined) constrainedValue = Math.min(max, constrainedValue);
      await onSave(constrainedValue);
    }
    closeEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    else if (e.key === 'Escape') { setEditValue(value?.toString() || ''); closeEditing(); }
  };

  const displayValue = value !== null && value !== undefined ? `${prefix}${value}${suffix}` : null;
  const isEmpty = value === null || value === undefined;

  if (disabled) {
    if (hideWhenEmpty && isEmpty) return null;
    return <span className={className}>{displayValue || placeholder}</span>;
  }

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1">
        {prefix && <span className="text-gray-500">{prefix}</span>}
        <input ref={inputRef} type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown} min={min} max={max} step={step}
          className={`${className} border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-20`} placeholder={placeholder} />
        {suffix && <span className="text-gray-500">{suffix}</span>}
      </div>
    );
  }

  if (hideWhenEmpty && isEmpty) return null;

  return (
    <span onClick={() => setIsEditing(true)}
      className={`${className} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 py-0.5 transition-colors ${!displayValue ? 'text-gray-400 italic' : ''}`}>
      {displayValue || placeholder}
    </span>
  );
}
