'use client';

import { useState, useRef, useEffect } from 'react';
import { formatDate } from '@/lib/utils/dateUtils';

interface EditableDateProps {
  value: Date | string | null;
  onSave: (value: Date) => void | Promise<void>;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showTime?: boolean;
}

export default function EditableDate({
  value, onSave, className = '', placeholder = 'Set date', disabled = false, showTime = false,
}: EditableDateProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (showTime) {
        setEditValue(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
      } else {
        setEditValue(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
      }
    } else {
      setEditValue('');
    }
  }, [value, showTime]);

  useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);

  const handleSave = async () => {
    if (editValue) {
      const newDate = new Date(editValue);
      if (!isNaN(newDate.getTime())) await onSave(newDate);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    else if (e.key === 'Escape') setIsEditing(false);
  };

  const getDisplayValue = () => {
    if (!value) return null;
    const date = new Date(value);
    return showTime ? date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : formatDate(date);
  };

  if (disabled) return <span className={className}>{getDisplayValue() || placeholder}</span>;

  if (isEditing) {
    return (
      <input ref={inputRef} type={showTime ? 'datetime-local' : 'date'} value={editValue} onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave} onKeyDown={handleKeyDown}
        className={`${className} border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`} />
    );
  }

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
