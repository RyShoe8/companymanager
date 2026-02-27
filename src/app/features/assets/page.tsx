import Link from 'next/link';
import Card from '@/components/ui/Card';
import MarketingPageHeader from '@/components/home/MarketingPageHeader';
import { StructuredData } from '@/components/StructuredData';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Assets - Centralized Resource Directory',
  description: 'Create a centralized directory of tools, documents, and resources. Organize and access all your company assets in one place. Link to projects and tasks.',
  keywords: 'asset management, resource directory, document management, tool repository, company assets',
  openGraph: {
    title: 'Assets - Centralized Resource Directory | Nucleas',
    description: 'Create a centralized directory of tools, documents, and resources.',
    type: 'website',
    url: `${baseUrl}/features/assets`,
  },
  alternates: { canonical: '/features/assets' },
};

export default function AssetsPage() {
  return (
    <>
      <StructuredData
        type="WebPage"
        data={{
          name: 'Assets | Nucleas',
          description: 'Centralized directory of tools, documents, and resources. Link to projects and tasks.',
          url: `${baseUrl}/features/assets`,
          publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl },
        }}
      />
      <div className="min-h-screen bg-background">
      <MarketingPageHeader
        badge="Across Plan, Build & Run"
        title="Assets"
        subtitle="Create a centralized directory of tools, documents, and resources. Organize and access all your company assets in one place. Link to projects and tasks."
        ctaText="Start Free"
        ctaHref="/register"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <Card className="p-8 md:p-10 mb-8 rounded-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-4">Centralized Asset Management</h2>
          <p className="text-text-secondary leading-relaxed mb-8">
            The Asset Repository is your organization&apos;s single source of truth for all tools, documents,
            resources, and assets. No more searching through emails or shared drives—everything is organized
            and easily accessible. Link assets to projects and tasks for context.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-primary-light border border-primary/20">
              <h3 className="text-lg font-semibold text-primary-dark mb-2">Categorization</h3>
              <p className="text-text-secondary text-sm">Organize assets by type: Tools, Documents, Links, Screenshots, Files, and more.</p>
            </div>
            <div className="p-6 rounded-xl bg-secondary-light border border-secondary/20">
              <h3 className="text-lg font-semibold text-secondary-dark mb-2">Search & Filter</h3>
              <p className="text-text-secondary text-sm">Quickly find assets with powerful search and filtering capabilities.</p>
            </div>
            <div className="p-6 rounded-xl bg-accent-light border border-accent/20">
              <h3 className="text-lg font-semibold text-accent-dark mb-2">Link to Projects</h3>
              <p className="text-text-secondary text-sm">Associate assets with projects and tasks for easy access in context.</p>
            </div>
            <div className="p-6 rounded-xl bg-primary-light border border-primary/20">
              <h3 className="text-lg font-semibold text-primary-dark mb-2">Smart Buttons</h3>
              <p className="text-text-secondary text-sm">Launch hosting, analytics, docs, and more in one click from each project.</p>
            </div>
          </div>
        </Card>

        <Card className="p-8 md:p-10 mb-8 rounded-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-6">Key Features</h2>
          <ul className="space-y-4 text-text-secondary">
            {[
              ['Asset Types', 'Categorize assets by type for better organization'],
              ['Quick Search', 'Find assets instantly with real-time search'],
              ['Filter by Type', 'Filter assets by category for focused browsing'],
              ['Link Storage', 'Store URLs and links to external resources'],
              ['Project & Task Links', 'Link assets to specific projects and tasks'],
            ].map(([title, desc]) => (
              <li key={title} className="flex gap-3">
                <span className="text-primary font-bold">✓</span>
                <span><strong className="text-text-primary">{title}:</strong> {desc}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
          <Link href="/register" className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors">
            Start Free
          </Link>
          <Link href="/#demo" className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/5 transition-colors">
            Try Interactive Demo
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
