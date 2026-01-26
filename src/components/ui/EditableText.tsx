'use client';

import { useState, useRef, useEffect } from 'react';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
}

export default function EditableText({
  value,
  onSave,
  className = '',
  placeholder = 'Click to edit',
  multiline = false,
  disabled = false,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (multiline && inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing, multiline]);

  const handleSave = async () => {
    if (editValue !== value) {
      await onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (disabled) {
    return <span className={className}>{value || placeholder}</span>;
  }

  if (isEditing) {
    const InputComponent = multiline ? 'textarea' : 'input';
    return (
      <InputComponent
        ref={inputRef as any}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`${className} border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500`}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`${className} cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 transition-colors ${
        !value ? 'text-gray-400 italic' : ''
      }`}
    >
      {value || placeholder}
    </span>
  );
}
