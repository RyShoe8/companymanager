import type { Metadata } from 'next';
import Link from 'next/link';
import PublicScreenshotTool from '@/components/tools/PublicScreenshotTool';
import { StructuredData } from '@/components/StructuredData';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata: Metadata = {
  title: 'Free Screenshot Tool',
  description:
    'Capture a browser tab, window, or screen and download the image locally. Free screenshot tool from Nucleas — no account required.',
  alternates: { canonical: '/tools/screenshot' },
  openGraph: {
    title: 'Free Screenshot Tool | Nucleas',
    description: 'Capture and download screenshots in your browser. No login required.',
    url: `${baseUrl}/tools/screenshot`,
  },
};

export default function PublicScreenshotToolPage() {
  return (
    <div className="min-h-screen bg-background">
      <StructuredData
        type="WebPage"
        data={{
          name: 'Free Screenshot Tool | Nucleas',
          description: metadata.description,
          url: `${baseUrl}/tools/screenshot`,
        }}
      />
      <section className="px-4 sm:px-6 lg:px-8 py-12 md:py-16 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <Link href="/tools" className="text-sm text-text-secondary hover:text-primary">
            ← All free tools
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mt-4 mb-3">
            Screenshot Tool
          </h1>
          <p className="text-text-secondary">
            Use your browser&apos;s screen picker to capture a tab, window, or display. Name your screenshot
            and download it — nothing is uploaded unless you sign in to Nucleas.
          </p>
        </div>
      </section>
      <section className="px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-background-card p-6 md:p-8">
          <PublicScreenshotTool />
        </div>
      </section>
    </div>
  );
}
