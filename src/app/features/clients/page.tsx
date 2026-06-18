import Link from 'next/link';
import { MarketingTrialCta } from '@/components/marketing/MarketingTrialCta';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';
import MarketingScreenshotFrame from '@/components/marketing/screenshots/MarketingScreenshotFrame';
import ClientsScreenshot from '@/components/marketing/screenshots/ClientsScreenshot';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Clients — Manage Every Relationship',
  description:
    'Manage client relationships with dedicated dashboards, headquarters hubs, project rollups, platforms and links, and printable impact reports. Built for agencies and multi-client operators.',
  keywords: [
    'client management',
    'agency client dashboard',
    'client portal',
    'client projects',
    'impact report',
    'client operations',
  ],
  alternates: { canonical: '/features/clients' },
  openGraph: {
    title: 'Clients — Manage Every Relationship | Nucleas',
    description: 'Dedicated client dashboards with HQ hubs, project rollups, and impact reports.',
    url: `${baseUrl}/features/clients`,
    type: 'website' as const,
  },
  twitter: { card: 'summary_large_image' as const, title: 'Clients | Nucleas' },
};

const FEATURES = [
  {
    title: 'Client Directory',
    desc: 'Browse all clients in a visual grid with status badges, domains, and active project counts at a glance.',
  },
  {
    title: 'Client Dashboard',
    desc: 'Open a dedicated detail view for each client with contact info, status, and everything tied to that relationship.',
  },
  {
    title: 'Client Headquarters',
    desc: 'Every client gets an HQ hub project for general tasks, content, and meetings — separate from deliverable work.',
  },
  {
    title: 'Platforms & Links',
    desc: 'Aggregate social profiles, tech stacks, marketing tools, and smart buttons across all client projects in one panel.',
  },
  {
    title: 'Active Project Rollups',
    desc: 'See deliverable projects grouped under each client with status, type, and quick navigation to project views.',
  },
  {
    title: 'Impact Reports',
    desc: 'Generate timeframe-based summaries of tasks, content, meetings, and hours — ready to print or share with clients.',
  },
  {
    title: 'Client Status Tracking',
    desc: 'Track clients through active, lead, and inactive lifecycle stages to match how your pipeline actually works.',
  },
];

export default function ClientsFeaturePage() {
  return (
    <>
      <StructuredData
        type="WebPage"
        data={{
          name: 'Clients | Nucleas',
          description: metadata.description,
          url: `${baseUrl}/features/clients`,
          publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl },
        }}
      />
      <StructuredData
        type="BreadcrumbList"
        data={{
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Features', item: `${baseUrl}/features` },
            { '@type': 'ListItem', position: 3, name: 'Clients', item: `${baseUrl}/features/clients` },
          ],
        }}
      />
      <div className="min-h-screen bg-background">
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
          <div className="absolute top-1/3 -right-32 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-4xl mx-auto text-center">
            <AnimateIn>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6">
                Clients
              </span>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">
                Every client,{' '}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  one dashboard
                </span>
              </h1>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                Manage client relationships at scale with dedicated dashboards, HQ hubs, project rollups, and impact
                reports — built for agencies, studios, and multi-client operators.
              </p>
            </AnimateIn>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <AnimateIn>
            <MarketingScreenshotFrame alt="Nucleas client dashboard with headquarters hub, operations panel, and active projects">
              <ClientsScreenshot />
            </MarketingScreenshotFrame>
          </AnimateIn>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-6xl mx-auto">
            <AnimateIn>
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-text-primary">
                  Client management that{' '}
                  <span className="text-primary">scales with you</span>
                </h2>
              </div>
            </AnimateIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <AnimateIn key={f.title}>
                  <div className="bg-background-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 hover:translate-y-[-2px] h-full">
                    <h3 className="text-base font-semibold text-text-primary mb-2">{f.title}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-20 bg-background-card/50">
          <div className="max-w-4xl mx-auto">
            <AnimateIn>
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl">
                  📊
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary mb-3">Impact Reports</h2>
                  <p className="text-text-secondary leading-relaxed">
                    Show clients the value you deliver with printable impact reports. Pick a timeframe and Nucleas
                    aggregates active projects, completed tasks, published content, meetings held, and hours logged —
                    then formats it into a share-ready summary you can print or walk through on a call.
                  </p>
                </div>
              </div>
            </AnimateIn>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-4">
            <Link
              href="/features/projects"
              className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium"
            >
              Explore Projects →
            </Link>
            <Link
              href="/features/team"
              className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium"
            >
              Explore Team →
            </Link>
          </div>
        </section>

        <MarketingTrialCta title="Start managing clients in Nucleas" />
      </div>
    </>
  );
}
