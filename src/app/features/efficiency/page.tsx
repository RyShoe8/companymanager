import Link from 'next/link';
import { MarketingTrialCta } from '@/components/marketing/MarketingTrialCta';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Efficiency & Organization — Work Smarter, Not Harder',
  description: 'Smart shortcuts, quick forms, keyboard shortcuts, lens views, organization branding, multi-project management, collaboration, and invitations. Nucleas efficiency features.',
  keywords: ['business efficiency', 'keyboard shortcuts', 'organization management', 'team collaboration', 'multi-project management'],
  alternates: { canonical: '/features/efficiency' },
  openGraph: { title: 'Efficiency & Organization — Work Smarter | Nucleas', description: 'Efficiency features and organizational tools for running your business.', url: `${baseUrl}/features/efficiency`, type: 'website' as const },
  twitter: { card: 'summary_large_image' as const, title: 'Efficiency | Nucleas' },
};

const EFFICIENCY = [
  { title: 'Smart Buttons', desc: 'Launch external tools and services in one click. Every project gets customizable buttons for hosting, analytics, docs, and more.' },
  { title: 'Quick Project Form', desc: 'Create new projects with minimal friction. A streamlined form gets you started in seconds, not minutes.' },
  { title: 'Quick Content Creation', desc: 'Fast content item creation with an inline modal. Add new content without navigating away from your current view.' },
  { title: 'Keyboard Shortcuts', desc: 'Efficient navigation and action execution with keyboard shortcuts. Power users can fly through their workflow.' },
  { title: 'Phase Filtering', desc: 'Quickly switch between Plan, Build, and Run phases. Focus on the work that matters right now.' },
  { title: 'Lens Views', desc: 'Different perspectives on your workspace — Schedule, Agenda, and more. See your work from the angle you need.' },
];

const ORGANIZATION = [
  { title: 'Organization Branding', desc: 'Custom branding for your organization. Upload logos, set colors, and make Nucleas feel like your own platform.' },
  { title: 'Multi-Project Management', desc: 'Manage multiple projects from a single dashboard. Switch between projects instantly with full context preservation.' },
  { title: 'Centralized Asset Repository', desc: 'Single source of truth for all tools, documents, and resources. No more hunting through folders, drives, and bookmarks.' },
  { title: 'Project & Task Links', desc: 'Link assets to specific projects and tasks for context. Every resource is connected to the work it supports.' },
  { title: 'Team Collaboration', desc: 'Built-in collaboration features for teams. Work together on projects, tasks, and content without leaving Nucleas.' },
  { title: 'Comments & Discussions', desc: 'Comment on projects, tasks, and content items. Keep discussions attached to the work they\'re about.' },
  { title: 'Invitations', desc: 'Invite team members to join your organization with a simple link. Role-based onboarding gets them started fast.' },
];

export default function EfficiencyFeaturePage() {
  return (
    <>
      <StructuredData type="WebPage" data={{ name: 'Efficiency & Organization | Nucleas', description: metadata.description, url: `${baseUrl}/features/efficiency`, publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl } }} />
      <StructuredData type="BreadcrumbList" data={{ itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }, { '@type': 'ListItem', position: 2, name: 'Features', item: `${baseUrl}/features` }, { '@type': 'ListItem', position: 3, name: 'Efficiency', item: `${baseUrl}/features/efficiency` }] }} />
      <div className="min-h-screen bg-background">
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-28"><div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" /><div className="relative max-w-4xl mx-auto text-center"><AnimateIn><span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6">Efficiency</span><h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">Work smarter,{' '}<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">not harder</span></h1><p className="text-lg text-text-secondary max-w-2xl mx-auto">Smart shortcuts, quick forms, keyboard navigation, and organizational features that eliminate friction from your daily workflow.</p></AnimateIn></div></section>

        {/* Efficiency Features */}
        <section className="px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-6xl mx-auto">
            <AnimateIn><div className="text-center mb-16"><p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">Speed</p><h2 className="text-3xl sm:text-4xl font-bold text-text-primary">Efficiency <span className="text-primary">features</span></h2></div></AnimateIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{EFFICIENCY.map((f) => (<AnimateIn key={f.title}><div className="bg-background-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 hover:translate-y-[-2px] h-full"><h3 className="text-base font-semibold text-text-primary mb-2">{f.title}</h3><p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p></div></AnimateIn>))}</div>
          </div>
        </section>

        {/* Organizational Features */}
        <section className="px-4 sm:px-6 lg:px-8 py-20 bg-background-card/50">
          <div className="max-w-6xl mx-auto">
            <AnimateIn><div className="text-center mb-16"><p className="text-sm font-semibold uppercase tracking-wider text-accent mb-3">Structure</p><h2 className="text-3xl sm:text-4xl font-bold text-text-primary">Organizational <span className="text-accent">features</span></h2></div></AnimateIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{ORGANIZATION.map((f) => (<AnimateIn key={f.title}><div className="bg-background border border-border rounded-2xl p-6 hover:border-accent/30 transition-all duration-300 hover:translate-y-[-2px] h-full"><h3 className="text-base font-semibold text-text-primary mb-2">{f.title}</h3><p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p></div></AnimateIn>))}</div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16"><div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-4"><Link href="/features/tools" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Tools →</Link><Link href="/features/team" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Team →</Link></div></section>
        <MarketingTrialCta title="Work smarter with Nucleas" />
      </div>
    </>
  );
}
