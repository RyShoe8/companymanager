import type { Metadata } from 'next';
import Link from 'next/link';
import { StructuredData } from '@/components/StructuredData';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata: Metadata = {
  title: 'Free Tools',
  description: 'Free browser-based tools from Nucleas. Capture screenshots and download them locally — no account required.',
  alternates: { canonical: '/tools' },
  openGraph: {
    title: 'Free Tools | Nucleas',
    description: 'Free browser-based tools from Nucleas.',
    url: `${baseUrl}/tools`,
  },
};

const TOOLS = [
  {
    href: '/tools/screenshot',
    title: 'Screenshot Tool',
    description:
      'Capture the full browser window or drag to select an area. Download locally — no account required.',
    icon: '📸',
  },
];

export default function FreeToolsPage() {
  return (
    <div className="min-h-screen bg-background">
      <StructuredData
        type="WebPage"
        data={{
          name: 'Free Tools | Nucleas',
          description: metadata.description,
          url: `${baseUrl}/tools`,
        }}
      />
      <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-24 border-b border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">Free Tools</h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Simple, browser-based utilities from Nucleas. No login required — use them instantly, or sign up to
            save assets inside your workspace.
          </p>
        </div>
      </section>
      <section className="px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="max-w-4xl mx-auto grid gap-6">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex gap-5 rounded-2xl border border-border bg-background-card p-6 hover:border-primary/40 transition-colors"
            >
              <span className="text-3xl shrink-0" aria-hidden>
                {tool.icon}
              </span>
              <div>
                <h2 className="text-xl font-semibold text-text-primary group-hover:text-primary transition-colors">
                  {tool.title}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">{tool.description}</p>
                <span className="inline-block mt-3 text-sm text-primary">Open tool →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
