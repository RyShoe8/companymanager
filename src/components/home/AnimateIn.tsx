'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimateInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: keyof JSX.IntrinsicElements;
}

export default function AnimateIn({ children, className = '', delay = 0, as: Tag = 'div' }: AnimateInProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  const animationClass = visible ? 'animate-fade-in-up opacity-100' : 'opacity-0 translate-y-4';

  return (
    <Tag ref={ref as any} className={`${animationClass} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
