'use client';

import { useState, useRef, useEffect } from 'react';

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
}

export default function EditableNumber({
  value, onSave, className = '', placeholder = '0', disabled = false,
  min, max, step = 1, suffix = '', prefix = '',
}: EditableNumberProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditValue(value?.toString() || ''); }, [value]);
  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  const handleSave = async () => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue !== value) {
      let constrainedValue = numValue;
      if (min !== undefined) constrainedValue = Math.max(min, constrainedValue);
      if (max !== undefined) constrainedValue = Math.min(max, constrainedValue);
      await onSave(constrainedValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    else if (e.key === 'Escape') { setEditValue(value?.toString() || ''); setIsEditing(false); }
  };

  const displayValue = value !== null && value !== undefined ? `${prefix}${value}${suffix}` : null;

  if (disabled) return <span className={className}>{displayValue || placeholder}</span>;

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

  return (
    <span onClick={() => setIsEditing(true)}
      className={`${className} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 py-0.5 transition-colors ${!displayValue ? 'text-gray-400 italic' : ''}`}>
      {displayValue || placeholder}
    </span>
  );
}
