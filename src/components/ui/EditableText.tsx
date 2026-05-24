'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  /** While editing, switch from input to textarea once length reaches this count. */
  autoMultilineAfter?: number;
  disabled?: boolean;
  /** When entering edit mode, replace these stored values with an empty field. */
  clearValuesOnEdit?: string[];
  /** Start in edit mode once on mount (e.g. new task row). */
  autoEditOnMount?: boolean;
  onAutoEditMount?: () => void;
}

export default function EditableText({
  value,
  onSave,
  className = '',
  placeholder = 'Click to edit',
  multiline = false,
  autoMultilineAfter,
  disabled = false,
  clearValuesOnEdit,
  autoEditOnMount = false,
  onAutoEditMount,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const prevUseMultilineRef = useRef(false);
  const autoEditAppliedRef = useRef(false);

  const useMultiline =
    multiline ||
    (autoMultilineAfter != null && editValue.length >= autoMultilineAfter);

  const valueForEdit = useCallback(
    (raw: string) => (clearValuesOnEdit?.includes(raw) ? '' : raw),
    [clearValuesOnEdit]
  );

  const startEditing = useCallback(() => {
    setEditValue(valueForEdit(value));
    setIsEditing(true);
  }, [value, valueForEdit]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (!autoEditOnMount || disabled || autoEditAppliedRef.current) return;
    autoEditAppliedRef.current = true;
    setEditValue(valueForEdit(value));
    setIsEditing(true);
    onAutoEditMount?.();
  }, [autoEditOnMount, disabled, value, valueForEdit, onAutoEditMount]);

  useEffect(() => {
    if (!isEditing) {
      prevUseMultilineRef.current = false;
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (multiline && inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing, multiline]);

  useLayoutEffect(() => {
    if (multiline) return;
    if (
      isEditing &&
      useMultiline &&
      !prevUseMultilineRef.current &&
      inputRef.current instanceof HTMLTextAreaElement
    ) {
      const len = editValue.length;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(len, len);
    }
    prevUseMultilineRef.current = useMultiline;
  }, [isEditing, useMultiline, editValue.length, multiline]);

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
    if (e.key === 'Enter' && !useMultiline && !e.shiftKey) {
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
    const editClassName = `${className} font-[inherit] text-inherit border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full block`;
    if (useMultiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`${editClassName} resize-y min-h-[4.5rem]`}
          placeholder={placeholder}
          rows={3}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={editClassName}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={startEditing}
      className={`${className} cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 transition-colors ${
        !value ? 'text-gray-400 italic' : ''
      }`}
    >
      {value || placeholder}
    </span>
  );
}
