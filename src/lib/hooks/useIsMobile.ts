'use client';

import { useState, useEffect } from 'react';

export default function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check initial state
    const checkIsMobile = () => setIsMobile(window.innerWidth < breakpoint);
    checkIsMobile();

    // Listen for resize
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, [breakpoint]);

  return isMobile;
}
