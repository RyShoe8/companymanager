import Link from 'next/link';
import { MarketingTrialCta } from '@/components/marketing/MarketingTrialCta';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';
import MarketingScreenshotFrame from '@/components/marketing/screenshots/MarketingScreenshotFrame';
import ProjectsScreenshot from '@/components/marketing/screenshots/ProjectsScreenshot';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Projects — Your Business Command Center',
  description: 'Manage projects end-to-end with custom colors, tasks, AI-powered time estimation, team assignments, status tracking, timelines, and tech/marketing stacks. All in Nucleas.',
  keywords: ['project management', 'task management', 'AI time estimation', 'team assignments', 'project tracking', 'business projects'],
  alternates: { canonical: '/features/projects' },
  openGraph: { title: 'Projects — Your Business Command Center | Nucleas', description: 'Manage projects end-to-end with AI time estimation, team assignments, and integrated stacks.', url: `${baseUrl}/features/projects`, type: 'website' as const },
  twitter: { card: 'summary_large_image' as const, title: 'Projects | Nucleas', description: 'Your business command center for managing projects end-to-end.' },
};

const FEATURES = [
  { title: 'Custom Project Colors', desc: 'Color-code projects for instant visual identification across your workspace, planning map, and calendar views.' },
  { title: 'Project Tasks', desc: 'Break down projects into manageable tasks with clear milestones, deliverables, and completion tracking.' },
  { title: 'AI Time Estimation', desc: 'Get intelligent hour estimates for projects automatically. Describe the work — AI analyzes and estimates for you.' },
  { title: 'Team Assignments', desc: 'Assign team members to projects and instantly see their workload impact across all assignments.' },
  { title: 'Status Tracking', desc: 'Monitor project status through Planning, In Development, In Review, and Completed phases with visual indicators.' },
  { title: 'Timeline Management', desc: 'Set start and end dates for better resource planning. See projects on the visual planning map across time horizons.' },
  { title: 'Project Marketing Stack', desc: 'Organize your hosting, analytics, domains, design tools, docs, billing, and marketing tools per project.' },
  { title: 'Project Tech Stack', desc: 'Document and display the technology stack used for each project — visible to the whole team at a glance.' },
  { title: 'Project Social Links', desc: 'Add and manage social media profiles and links for each project. Always accessible from the project view.' },
  { title: 'Project Logos', desc: 'Upload custom project logos for visual branding. Logos appear in cards, the planning map, and meeting views.' },
  { title: 'Resource Planning', desc: 'See how projects impact team member capacity. Make informed decisions about assignments and timelines.' },
  { title: 'Flexible Tasks', desc: 'Define as many tasks and content items as needed for each project. No artificial limits on project complexity.' },
];

export default function ProjectsFeaturePage() {
  return (
    <>
      <StructuredData type="WebPage" data={{ name: 'Projects | Nucleas', description: metadata.description, url: `${baseUrl}/features/projects`, publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl } }} />
      <StructuredData type="BreadcrumbList" data={{ itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }, { '@type': 'ListItem', position: 2, name: 'Features', item: `${baseUrl}/features` }, { '@type': 'ListItem', position: 3, name: 'Projects', item: `${baseUrl}/features/projects` }] }} />
      <div className="min-h-screen bg-background">
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
          <div className="absolute top-1/3 -right-32 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-4xl mx-auto text-center">
            <AnimateIn>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6">Projects</span>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">Your business{' '}<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">command center</span></h1>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">Manage projects end-to-end with tasks, timelines, team assignments, AI-powered estimation, and integrated tech and marketing stacks.</p>
            </AnimateIn>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <AnimateIn>
            <MarketingScreenshotFrame
              alt="Nucleas project management interface with tasks, assignments, and timeline"
            >
              <ProjectsScreenshot />
            </MarketingScreenshotFrame>
          </AnimateIn>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-6xl mx-auto">
            <AnimateIn><div className="text-center mb-16"><h2 className="text-3xl sm:text-4xl font-bold text-text-primary">Everything you need to manage <span className="text-primary">projects</span></h2></div></AnimateIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (<AnimateIn key={f.title}><div className="bg-background-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 hover:translate-y-[-2px] h-full"><h3 className="text-base font-semibold text-text-primary mb-2">{f.title}</h3><p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p></div></AnimateIn>))}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-20 bg-background-card/50">
          <div className="max-w-4xl mx-auto">
            <AnimateIn>
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl">🤖</div>
                <div><h2 className="text-2xl font-bold text-text-primary mb-3">AI-Powered Time Estimation</h2><p className="text-text-secondary leading-relaxed">Stop guessing how long work takes. Nucleas uses AI to analyze your project tasks and content, then generates intelligent hour estimates. Describe the work in natural language — the AI handles the math, giving you accurate timelines and better resource planning.</p></div>
              </div>
            </AnimateIn>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16"><div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-4">
          <Link href="/features/tasks" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Tasks →</Link>
          <Link href="/features/team" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Team →</Link>
        </div></section>

        <MarketingTrialCta title="Start managing projects smarter" />
      </div>
    </>
  );
}
