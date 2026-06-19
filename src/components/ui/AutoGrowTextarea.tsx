'use client';

import { useRef, useLayoutEffect, TextareaHTMLAttributes } from 'react';
import { adjustTextareaHeight } from '@/lib/ui/autoGrowTextarea';

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
    adjustTextareaHeight(el, minRows);
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
