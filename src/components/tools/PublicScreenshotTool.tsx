'use client';

import Link from 'next/link';
import ScreenshotToolPanel from '@/components/shared/ScreenshotToolPanel';

export default function PublicScreenshotTool() {
  return (
    <div className="space-y-8">
      <ScreenshotToolPanel downloadOnly target={null} />
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
        <p className="text-sm text-text-secondary mb-4">
          Sign in to save screenshots to your projects, link them to tasks, and build your asset library.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center px-6 py-2.5 rounded-xl bg-primary text-nucleas-ink font-semibold text-sm hover:bg-primary-hover transition-all"
        >
          Start your free trial
        </Link>
      </div>
    </div>
  );
}
