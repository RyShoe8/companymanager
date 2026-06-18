import Link from 'next/link';
import { MarketingTrialCta } from '@/components/marketing/MarketingTrialCta';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Features — Everything You Need to Run Your Business',
  description: 'Explore the full Nucleas platform: Projects, Clients, Tasks, Content, Meetings, Tools, Team management, and Efficiency features. The smart operating system for building and running a business.',
  keywords: ['business features', 'project management features', 'team management', 'content planning', 'meeting scheduling', 'business tools'],
  alternates: { canonical: '/features' },
  openGraph: {
    title: 'Features — Everything You Need to Run Your Business | Nucleas',
    description: 'Explore the full Nucleas platform. Projects, tasks, content, meetings, tools, and team management — all connected.',
    url: `${baseUrl}/features`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: 'Features | Nucleas',
    description: 'The full platform for building and running a business.',
  },
};

const CATEGORIES = [
  { title: 'Projects', desc: 'Manage projects end-to-end with tasks, timelines, team assignments, and AI-powered time estimation.', href: '/features/projects', icon: '📁' },
  { title: 'Clients', desc: 'Dedicated client dashboards with HQ hubs, project rollups, platforms and links, and impact reports.', href: '/features/clients', icon: '🏢' },
  { title: 'Tasks', desc: 'Break down projects into clear tasks with status tracking, recurrence, linked assets, and time estimation.', href: '/features/tasks', icon: '✅' },
  { title: 'Content', desc: 'Plan, schedule, and distribute content across channels with targeting, assets, and team coordination.', href: '/features/content', icon: '📝' },
  { title: 'Meetings', desc: 'Walk into calls with project context, agendas, insights, and one-click join.', href: '/features/meetings', icon: '📹' },
  { title: 'Scheduling', desc: 'Plan meetings on a workspace calendar with team availability and linked projects.', href: '/features/scheduling', icon: '📅' },
  { title: 'Tools', desc: 'Built-in screenshot capture, screen recording, smart buttons, and centralized asset management.', href: '/features/tools', icon: '⚡' },
  { title: 'Team', desc: 'Track capacity, workload, assignments, and roles. See how every project impacts your team.', href: '/features/team', icon: '👥' },
  { title: 'Efficiency & Organization', desc: 'Smart shortcuts, quick forms, lens views, organization branding, and collaboration features.', href: '/features/efficiency', icon: '🚀' },
];

export default function FeaturesPage() {
  return (
    <>
      <StructuredData type="WebPage" data={{ name: 'Features | Nucleas', description: metadata.description, url: `${baseUrl}/features`, publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl } }} />
      <StructuredData type="BreadcrumbList" data={{ itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }, { '@type': 'ListItem', position: 2, name: 'Features', item: `${baseUrl}/features` }] }} />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
          <div className="absolute top-1/3 -right-32 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-4xl mx-auto text-center">
            <AnimateIn>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6">Platform</span>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">
                Everything you need to{' '}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">run your business</span>
              </h1>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10">
                Nine integrated modules that work together as one operating system. Not another project manager — the business management layer.
              </p>
            </AnimateIn>
          </div>
        </section>

        {/* Category Grid */}
        <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-32">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CATEGORIES.map((cat) => (
              <AnimateIn key={cat.title}>
                <Link href={cat.href} className="group block bg-background-card border border-border rounded-2xl p-8 hover:border-primary/30 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg hover:shadow-primary/5 h-full">
                  <span className="text-3xl mb-4 block">{cat.icon}</span>
                  <h2 className="text-xl font-semibold text-text-primary mb-2 group-hover:text-primary transition-colors">{cat.title}</h2>
                  <p className="text-text-secondary text-sm leading-relaxed mb-4">{cat.desc}</p>
                  <span className="text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">Learn more →</span>
                </Link>
              </AnimateIn>
            ))}
          </div>
        </section>

        <MarketingTrialCta title="Start building with Nucleas" className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-32" />
      </div>
    </>
  );
}
