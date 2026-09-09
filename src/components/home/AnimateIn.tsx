'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observeEntrance } from '@/lib/ui/observeEntrance';

interface AnimateInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: keyof React.JSX.IntrinsicElements;
}

export default function AnimateIn({ children, className = '', delay = 0, as: Tag = 'div' }: AnimateInProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const setElement = useCallback((element: HTMLElement | null) => {
    ref.current = element;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible) return;
    return observeEntrance(el, () => setVisible(true), delay);
  }, [delay, visible]);

  const animationClass = visible ? 'animate-fade-in-up opacity-100' : 'opacity-0 translate-y-4';

  const Element = Tag as React.ElementType;
  return <Element ref={setElement} className={`${animationClass} ${className}`.trim()}>{children}</Element>;
}
