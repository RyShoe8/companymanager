'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import useIsMobile from '@/lib/hooks/useIsMobile';

const PERIOD_KEY = 'nucleas-feedback-period-start';
const VIEWS_KEY = 'nucleas-feedback-page-views';
const PERIOD_MS = 4 * 24 * 60 * 60 * 1000;
const MAX_VIEWS = 2;

function readPeriodStart(): number {
  if (typeof window === 'undefined') return Date.now();
  const raw = localStorage.getItem(PERIOD_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function writePeriodStart(ms: number): void {
  localStorage.setItem(PERIOD_KEY, String(ms));
}

function readViewCount(): number {
  if (typeof window === 'undefined') return 0;
  const raw = sessionStorage.getItem(VIEWS_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeViewCount(count: number): void {
  sessionStorage.setItem(VIEWS_KEY, String(count));
}

/**
 * On mobile, show feedback FAB only for the first two page views per 4-day period.
 */
export function useFeedbackVisibility(): boolean {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setVisible(true);
      return;
    }

    const now = Date.now();
    let periodStart = readPeriodStart();
    if (!periodStart || now - periodStart >= PERIOD_MS) {
      periodStart = now;
      writePeriodStart(periodStart);
      writeViewCount(0);
    }

    const views = readViewCount();
    if (views < MAX_VIEWS) {
      writeViewCount(views + 1);
      setVisible(views + 1 <= MAX_VIEWS);
    } else {
      setVisible(false);
    }
  }, [isMobile, pathname]);

  return visible;
}
