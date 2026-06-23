'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import { COMMUNITY_SOCIAL_LINKS } from '@/lib/constants/communitySocialLinks';
import type { GuideStep } from '@/lib/platformGuide/types';

const POLL_MS = 100;
const POLL_MAX = 30;

function tourSelector(target: string): string {
  return `[data-tour="${target}"]`;
}

async function waitForTarget(
  target: string | null | undefined,
  skipIfMissing?: boolean
): Promise<Element | null> {
  if (!target) return null;
  const selector = tourSelector(target);
  for (let i = 0; i < POLL_MAX; i++) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return skipIfMissing ? null : document.querySelector(selector);
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 && r.height <= 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

interface PlatformGuideOverlayProps {
  step: GuideStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onEnd: () => void;
}

export default function PlatformGuideOverlay({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onEnd,
}: PlatformGuideOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [targetEl, setTargetEl] = useState<Element | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshRect = useCallback(() => {
    setRect(measure(targetEl));
  }, [targetEl]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const el = await waitForTarget(step.target, step.skipIfTargetMissing);
      if (cancelled) return;
      setTargetEl(el);
      setRect(measure(el));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [step.id, step.skipIfTargetMissing, step.target]);

  useLayoutEffect(() => {
    refreshRect();
    const onScrollOrResize = () => refreshRect();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [refreshRect, targetEl]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  const isCentered = !step.target || !rect;
  const padding = 8;
  const highlight = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  const popoverStyle: React.CSSProperties = isCentered
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '28rem',
        width: 'calc(100% - 2rem)',
      }
    : (() => {
        const gap = 12;
        const popW = 320;
        const below = (highlight?.top ?? 0) + (highlight?.height ?? 0) + gap;
        const above = (highlight?.top ?? 0) - gap;
        const preferBottom = below + 200 < window.innerHeight;
        const top = preferBottom ? below : Math.max(16, above - 200);
        let left = (highlight?.left ?? 0) + (highlight?.width ?? 0) / 2 - popW / 2;
        left = Math.max(16, Math.min(left, window.innerWidth - popW - 16));
        return {
          position: 'fixed' as const,
          top,
          left,
          width: popW,
          maxWidth: 'calc(100% - 2rem)',
        };
      })();

  const isLast = stepIndex >= totalSteps - 1;

  return createPortal(
    <div className="fixed inset-0 z-[130]" role="dialog" aria-modal="true" aria-labelledby="platform-guide-title">
      <div className="absolute inset-0 bg-black/55" onClick={() => {}} aria-hidden />
      {highlight ? (
        <div
          className="absolute rounded-lg ring-2 ring-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      ) : null}
      <div
        className="bg-background-card border border-border rounded-xl shadow-2xl p-5 z-[131]"
        style={popoverStyle}
      >
        <p className="text-xs text-text-muted mb-2">
          Step {stepIndex + 1} of {totalSteps}
        </p>
        <h2 id="platform-guide-title" className="text-lg font-semibold text-text-primary mb-2">
          {step.title}
        </h2>
        <p className="text-sm text-text-secondary mb-5 leading-relaxed">{step.body}</p>
        {step.showCommunityLinks ? (
          <div className="flex flex-col gap-2 mb-5">
            {COMMUNITY_SOCIAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-background-hover"
              >
                {link.label}
                <svg className="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
                </svg>
              </a>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onEnd}>
            End Guide
          </Button>
          <Button type="button" onClick={onNext}>
            {isLast ? 'Finish' : 'OK'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
