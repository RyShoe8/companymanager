import Link from 'next/link';
import { MarketingTrialCta } from '@/components/marketing/MarketingTrialCta';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Tasks — Break It Down, Get It Done',
  description: 'Define detailed tasks within projects with status tracking, recurrence, linked assets, team assignments, and time estimation. Manage tasks inline within Nucleas.',
  keywords: ['task management', 'task tracking', 'recurring tasks', 'task assignments', 'project tasks'],
  alternates: { canonical: '/features/tasks' },
  openGraph: { title: 'Tasks — Break It Down, Get It Done | Nucleas', description: 'Task management with status tracking, recurrence, and linked assets.', url: `${baseUrl}/features/tasks`, type: 'website' as const },
  twitter: { card: 'summary_large_image' as const, title: 'Tasks | Nucleas' },
};

const FEATURES = [
  { title: 'Task Breakdown', desc: 'Define detailed tasks within projects with clear deliverables. Break complex work into manageable pieces that your team can execute.' },
  { title: 'Task Status Tracking', desc: 'Monitor individual task progress with visual status indicators. See what\'s pending, in progress, and completed at a glance.' },
  { title: 'Task Recurrence', desc: 'Set up recurring tasks for repeated work — daily, weekly, monthly, or custom schedules. Never forget a regular deliverable again.' },
  { title: 'Task Linked Assets', desc: 'Link relevant documents, screenshots, recordings, and resources directly to specific tasks. Everything your team needs in one place.' },
  { title: 'Task Assignments', desc: 'Assign tasks to specific team members with clear ownership. See assignments reflected in capacity and workload views.' },
  { title: 'Task Time Estimation', desc: 'Estimate hours for individual tasks manually or with AI assistance. Track estimated vs. actual time for better future planning.' },
  { title: 'Inline Task Management', desc: 'Manage tasks directly within the project inspector view. Add, edit, reorder, and complete tasks without leaving context.' },
];

export default function TasksFeaturePage() {
  return (
    <>
      <StructuredData type="WebPage" data={{ name: 'Tasks | Nucleas', description: metadata.description, url: `${baseUrl}/features/tasks`, publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl } }} />
      <StructuredData type="BreadcrumbList" data={{ itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }, { '@type': 'ListItem', position: 2, name: 'Features', item: `${baseUrl}/features` }, { '@type': 'ListItem', position: 3, name: 'Tasks', item: `${baseUrl}/features/tasks` }] }} />
      <div className="min-h-screen bg-background">
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
          <div className="relative max-w-4xl mx-auto text-center">
            <AnimateIn>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6">Tasks</span>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">Break it down,{' '}<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">get it done</span></h1>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">Define detailed tasks with status tracking, recurrence, linked assets, and team assignments. Manage everything inline within your projects.</p>
            </AnimateIn>
          </div>
        </section>
        <section className="px-4 sm:px-6 lg:px-8 py-20"><div className="max-w-6xl mx-auto"><AnimateIn><div className="text-center mb-16"><h2 className="text-3xl sm:text-4xl font-bold text-text-primary">Powerful <span className="text-primary">task management</span></h2></div></AnimateIn><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{FEATURES.map((f) => (<AnimateIn key={f.title}><div className="bg-background-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 hover:translate-y-[-2px] h-full"><h3 className="text-base font-semibold text-text-primary mb-2">{f.title}</h3><p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p></div></AnimateIn>))}</div></div></section>
        <section className="px-4 sm:px-6 lg:px-8 py-20 bg-background-card/50"><div className="max-w-4xl mx-auto"><AnimateIn><div className="flex flex-col md:flex-row gap-8 items-center"><div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-nucleas-fourth flex items-center justify-center text-3xl">🔄</div><div><h2 className="text-2xl font-bold text-text-primary mb-3">Task Recurrence</h2><p className="text-text-secondary leading-relaxed">Some work happens on a schedule. Set up recurring tasks for weekly reports, monthly reviews, daily standups, or any custom cadence. Nucleas automatically creates task instances so nothing falls through the cracks. Track completion history and adjust schedules as your workflow evolves.</p></div></div></AnimateIn></div></section>
        <section className="px-4 sm:px-6 lg:px-8 py-16"><div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-4"><Link href="/features/projects" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Projects →</Link><Link href="/features/content" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Content →</Link></div></section>
        <MarketingTrialCta title="Start breaking work into tasks" />
      </div>
    </>
  );
}
