import Link from 'next/link';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Team — Know Your Team\'s Capacity',
  description: 'Track team capacity, workload, assignments, roles, and utilization. See how every project impacts your team members and make informed resource decisions.',
  keywords: ['team management', 'capacity tracking', 'workload management', 'employee management', 'resource planning', 'team utilization'],
  alternates: { canonical: '/features/team' },
  openGraph: { title: 'Team — Know Your Team\'s Capacity | Nucleas', description: 'Team capacity, workload, and assignment tracking.', url: `${baseUrl}/features/team`, type: 'website' as const },
  twitter: { card: 'summary_large_image' as const, title: 'Team | Nucleas' },
};

const FEATURES = [
  { title: 'Capacity Tracking', desc: 'Set and track weekly hours for each team member. See available capacity vs. assigned hours at a glance.' },
  { title: 'Workload Visibility', desc: 'Visualize how projects and tasks impact each team member\'s workload. Spot overloaded team members before burnout.' },
  { title: 'Role Management', desc: 'Assign roles — Manager, User — with appropriate permissions and access levels. Keep sensitive data secure.' },
  { title: 'Assignment Tracking', desc: 'See all projects and tasks assigned to each team member in one view. Understand who\'s working on what.' },
  { title: 'Weekly Hours', desc: 'Set and track weekly capacity for each employee. Full-time, part-time, and contractor hours all supported.' },
  { title: 'Employee Types', desc: 'Categorize employees as full-time, part-time, or contractor. Different types can have different capacity and access settings.' },
  { title: 'Role-Based Access', desc: 'Control what team members can see and do. Managers get full access; users see their assigned work.' },
  { title: 'Workload Analysis', desc: 'Analyze how assignments impact team member capacity over time. Make data-driven decisions about resource allocation.' },
  { title: 'Team Overview', desc: 'Complete dashboard view of your entire team — capacity, assignments, roles, and availability in one place.' },
  { title: 'Employee Sidebar', desc: 'Quick access panel showing employee details, current assignments, capacity utilization, and contact information.' },
];

export default function TeamFeaturePage() {
  return (
    <>
      <StructuredData type="WebPage" data={{ name: 'Team | Nucleas', description: metadata.description, url: `${baseUrl}/features/team`, publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl } }} />
      <StructuredData type="BreadcrumbList" data={{ itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }, { '@type': 'ListItem', position: 2, name: 'Features', item: `${baseUrl}/features` }, { '@type': 'ListItem', position: 3, name: 'Team', item: `${baseUrl}/features/team` }] }} />
      <div className="min-h-screen bg-background">
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-28"><div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" /><div className="relative max-w-4xl mx-auto text-center"><AnimateIn><span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6">Team</span><h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">Know your team&apos;s{' '}<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">capacity</span></h1><p className="text-lg text-text-secondary max-w-2xl mx-auto">Track capacity, workload, assignments, and roles. See how every project impacts your team and make informed resource decisions.</p></AnimateIn></div></section>
        <section className="px-4 sm:px-6 lg:px-8 pb-16"><AnimateIn><div className="max-w-4xl mx-auto relative"><div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 rounded-2xl blur-xl opacity-40" /><div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl"><img src="/images/marketing/features-team.png" alt="Nucleas team management with capacity bars, workload distribution, and role badges" className="w-full h-auto" loading="eager" /></div></div></AnimateIn></section>
        <section className="px-4 sm:px-6 lg:px-8 py-20"><div className="max-w-6xl mx-auto"><AnimateIn><div className="text-center mb-16"><h2 className="text-3xl sm:text-4xl font-bold text-text-primary">Complete <span className="text-primary">team management</span></h2></div></AnimateIn><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{FEATURES.map((f) => (<AnimateIn key={f.title}><div className="bg-background-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 hover:translate-y-[-2px] h-full"><h3 className="text-base font-semibold text-text-primary mb-2">{f.title}</h3><p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p></div></AnimateIn>))}</div></div></section>
        <section className="px-4 sm:px-6 lg:px-8 py-20 bg-background-card/50"><div className="max-w-4xl mx-auto"><AnimateIn><div className="flex flex-col md:flex-row gap-8 items-center"><div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl">📊</div><div><h2 className="text-2xl font-bold text-text-primary mb-3">Capacity Tracking</h2><p className="text-text-secondary leading-relaxed">Set weekly hours for each team member and see their capacity utilization in real time. Nucleas shows you who has bandwidth and who&apos;s overloaded — before you assign new work. Capacity bars, utilization percentages, and assignment counts give you the full picture. Make staffing decisions with data, not guesses.</p></div></div></AnimateIn></div></section>
        <section className="px-4 sm:px-6 lg:px-8 py-16"><div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-4"><Link href="/features/projects" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Projects →</Link><Link href="/features/tasks" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Tasks →</Link></div></section>
        <section className="px-4 sm:px-6 lg:px-8 pb-20"><div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-nucleas-fourth/10 border border-primary/20 p-10 md:p-16 text-center"><div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" /><div className="relative"><h2 className="text-3xl font-bold text-text-primary mb-4">Start managing your team better</h2><p className="text-text-secondary mb-8">Full platform access. 14-day free trial. No credit card required.</p><Link href="/register" className="inline-flex items-center px-8 py-4 rounded-xl bg-primary text-nucleas-ink font-semibold text-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/25">Start Your 14-Day Free Trial</Link></div></div></section>
      </div>
    </>
  );
}
