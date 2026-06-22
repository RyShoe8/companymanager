'use client';

import { forwardRef, useLayoutEffect, useRef, useImperativeHandle, TextareaHTMLAttributes } from 'react';
import { adjustTextareaHeight } from '@/lib/ui/autoGrowTextarea';

interface AutoGrowTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
  minRows?: number;
}

const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(function AutoGrowTextarea(
  { minRows = 2, className = '', value, onChange, ...rest },
  forwardedRef
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement);

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
});

export default AutoGrowTextarea;
