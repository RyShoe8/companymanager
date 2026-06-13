import Link from 'next/link';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Meetings — Every Meeting, Fully Prepared',
  description: 'Schedule meetings with full project context, agendas, availability management, project insights, and one-click video join. Never walk into a meeting unprepared.',
  keywords: ['meeting management', 'meeting scheduling', 'meeting agenda', 'calendar view', 'project insights', 'video meetings'],
  alternates: { canonical: '/features/meetings' },
  openGraph: { title: 'Meetings — Every Meeting, Fully Prepared | Nucleas', description: 'Meeting management with project context and one-click join.', url: `${baseUrl}/features/meetings`, type: 'website' as const },
  twitter: { card: 'summary_large_image' as const, title: 'Meetings | Nucleas' },
};

const FEATURES = [
  { title: 'Meeting Creation', desc: 'Create and schedule meetings with team members in seconds. Set date, time, duration, and link projects for full context.' },
  { title: 'Meeting Agenda', desc: 'Link projects to meetings so everyone has access to all relevant information — tasks, status, assets, and context — before the call.' },
  { title: 'Calendar View', desc: 'Visual calendar view for scheduling and viewing meetings. See your week at a glance alongside project deadlines and content schedules.' },
  { title: 'Meeting Availability', desc: 'Set and manage your availability for meeting scheduling. Let your team know when you\'re free without back-and-forth emails.' },
  { title: 'Meeting Project Insights', desc: 'See full project context during meetings — colors, tech stack, marketing tools, social links, URLs, and team assignments. Everything visible in one panel.' },
  { title: 'One-Click Join', desc: 'Jump into video calls with a single click. No hunting for links or switching apps — the join button is right on the meeting card.' },
  { title: 'Meeting Detail View', desc: 'Comprehensive view of meeting details, agenda, participants, and linked projects. Review everything before, during, or after the call.' },
  { title: 'Scheduling Panel', desc: 'Dedicated panel for managing meeting schedules. Drag, drop, and organize your meetings alongside your team\'s availability.' },
  { title: 'Calendar Bar', desc: 'Quick access calendar bar for fast scheduling. Pick dates and times without navigating away from your current view.' },
];

export default function MeetingsFeaturePage() {
  return (
    <>
      <StructuredData type="WebPage" data={{ name: 'Meetings | Nucleas', description: metadata.description, url: `${baseUrl}/features/meetings`, publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl } }} />
      <StructuredData type="BreadcrumbList" data={{ itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }, { '@type': 'ListItem', position: 2, name: 'Features', item: `${baseUrl}/features` }, { '@type': 'ListItem', position: 3, name: 'Meetings', item: `${baseUrl}/features/meetings` }] }} />
      <div className="min-h-screen bg-background">
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-28"><div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" /><div className="relative max-w-4xl mx-auto text-center"><AnimateIn><span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6">Meetings</span><h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">Every meeting,{' '}<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">fully prepared</span></h1><p className="text-lg text-text-secondary max-w-2xl mx-auto">Schedule meetings with full project context, agendas linked to real work, and one-click join. Never walk into a meeting unprepared again.</p></AnimateIn></div></section>
        <section className="px-4 sm:px-6 lg:px-8 pb-16"><AnimateIn><div className="max-w-4xl mx-auto relative"><div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 rounded-2xl blur-xl opacity-40" /><div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl"><img src="/images/marketing/features-meetings.png" alt="Nucleas meeting scheduling with calendar, project insights, and agenda" className="w-full h-auto" loading="eager" /></div></div></AnimateIn></section>
        <section className="px-4 sm:px-6 lg:px-8 py-20"><div className="max-w-6xl mx-auto"><AnimateIn><div className="text-center mb-16"><h2 className="text-3xl sm:text-4xl font-bold text-text-primary">Meetings with <span className="text-primary">real context</span></h2></div></AnimateIn><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{FEATURES.map((f) => (<AnimateIn key={f.title}><div className="bg-background-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 hover:translate-y-[-2px] h-full"><h3 className="text-base font-semibold text-text-primary mb-2">{f.title}</h3><p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p></div></AnimateIn>))}</div></div></section>
        <section className="px-4 sm:px-6 lg:px-8 py-20 bg-background-card/50"><div className="max-w-4xl mx-auto"><AnimateIn><div className="flex flex-col md:flex-row gap-8 items-center"><div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl">🔍</div><div><h2 className="text-2xl font-bold text-text-primary mb-3">Meeting Project Insights</h2><p className="text-text-secondary leading-relaxed">When you link a project to a meeting, Nucleas surfaces everything your team needs: project colors, tech stack icons, marketing tools, social profiles, dev and live URLs, team assignments, and recent activity. No more scrambling to find context — it&apos;s all right there in the meeting view.</p></div></div></AnimateIn></div></section>
        <section className="px-4 sm:px-6 lg:px-8 py-16"><div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-4"><Link href="/features/projects" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Projects →</Link><Link href="/features/team" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Team →</Link></div></section>
        <section className="px-4 sm:px-6 lg:px-8 pb-20"><div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-nucleas-fourth/10 border border-primary/20 p-10 md:p-16 text-center"><div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" /><div className="relative"><h2 className="text-3xl font-bold text-text-primary mb-4">Run meetings that matter</h2><p className="text-text-secondary mb-8">Full platform access. 14-day free trial. No credit card required.</p><Link href="/register" className="inline-flex items-center px-8 py-4 rounded-xl bg-primary text-nucleas-ink font-semibold text-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/25">Start Your 14-Day Free Trial</Link></div></div></section>
      </div>
    </>
  );
}
