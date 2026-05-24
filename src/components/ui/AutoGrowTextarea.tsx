'use client';

import { useRef, useLayoutEffect, TextareaHTMLAttributes } from 'react';

interface AutoGrowTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
  minRows?: number;
}

export default function AutoGrowTextarea({
  minRows = 2,
  className = '',
  value,
  onChange,
  ...rest
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 20;
    const minHeight = lineHeight * minRows + (parseInt(getComputedStyle(el).paddingTop, 10) || 0) + (parseInt(getComputedStyle(el).paddingBottom, 10) || 0);
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value, minRows]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        adjustHeight();
      }}
      className={`w-full px-4 py-2 border border-border rounded-lg bg-background-card text-text-primary resize-none overflow-hidden ${className}`}
      {...rest}
    />
  );
}
