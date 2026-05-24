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
  const [forceMultiline, setForceMultiline] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const prevUseMultilineRef = useRef(false);
  const pendingCaretPosRef = useRef<number | null>(null);
  const autoEditAppliedRef = useRef(false);

  const useMultiline =
    multiline ||
    forceMultiline ||
    (autoMultilineAfter != null && editValue.length >= autoMultilineAfter);

  const preserveFormatting =
    multiline || autoMultilineAfter != null || value.includes('\n');

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
      setForceMultiline(false);
      pendingCaretPosRef.current = null;
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
    if (!isEditing || !inputRef.current) return;

    const el = inputRef.current;

    if (pendingCaretPosRef.current != null && el instanceof HTMLTextAreaElement) {
      const pos = pendingCaretPosRef.current;
      pendingCaretPosRef.current = null;
      el.focus();
      el.setSelectionRange(pos, pos);
      prevUseMultilineRef.current = useMultiline;
      return;
    }

    if (multiline) return;

    if (
      useMultiline &&
      !prevUseMultilineRef.current &&
      el instanceof HTMLTextAreaElement
    ) {
      const len = editValue.length;
      el.focus();
      el.setSelectionRange(len, len);
    }
    prevUseMultilineRef.current = useMultiline;
  }, [isEditing, useMultiline, editValue, multiline]);

  const handleSave = async () => {
    if (editValue !== value) {
      await onSave(editValue);
    }
    pendingCaretPosRef.current = null;
    setForceMultiline(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    pendingCaretPosRef.current = null;
    setForceMultiline(false);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && e.shiftKey && (multiline || autoMultilineAfter != null)) {
      const el = e.currentTarget as HTMLInputElement | HTMLTextAreaElement;
      const start = el.selectionStart ?? editValue.length;
      const end = el.selectionEnd ?? start;
      e.preventDefault();
      const nextValue = editValue.slice(0, start) + '\n' + editValue.slice(end);
      pendingCaretPosRef.current = start + 1;
      setEditValue(nextValue);
      if (!useMultiline) setForceMultiline(true);
      return;
    }
    if (e.key === 'Enter' && !useMultiline && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (disabled) {
    return (
      <span className={`${className}${preserveFormatting ? ' whitespace-pre-wrap' : ''}`}>
        {value || placeholder}
      </span>
    );
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
      }${preserveFormatting ? ' whitespace-pre-wrap' : ''}`}
    >
      {value || placeholder}
    </span>
  );
}
