import Link from 'next/link';
import { MarketingTrialCta } from '@/components/marketing/MarketingTrialCta';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';
import MarketingScreenshotFrame from '@/components/marketing/screenshots/MarketingScreenshotFrame';
import SchedulingScreenshot from '@/components/marketing/screenshots/SchedulingScreenshot';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Scheduling — Plan Meetings in Your Workspace',
  description:
    'Schedule meetings from the Nucleas workspace with a visual calendar, team availability sidebar, and linked project context.',
  keywords: ['meeting scheduling', 'calendar view', 'team availability', 'workspace scheduling', 'meeting calendar'],
  alternates: { canonical: '/features/scheduling' },
  openGraph: {
    title: 'Scheduling — Plan Meetings in Your Workspace | Nucleas',
    description: 'Visual scheduling workspace with calendar and team capacity.',
    url: `${baseUrl}/features/scheduling`,
    type: 'website' as const,
  },
  twitter: { card: 'summary_large_image' as const, title: 'Scheduling | Nucleas' },
};

const FEATURES = [
  { title: 'Workspace Calendar', desc: 'See meetings on a weekly calendar inside the Schedule phase. Plan around project deadlines and content publish dates.' },
  { title: 'Team Availability', desc: 'The capacity sidebar shows who is booked and who has room — schedule without endless back-and-forth.' },
  { title: 'Linked Projects', desc: 'Attach projects to meetings when you schedule them so context is ready before the call starts.' },
  { title: 'Meeting Creation', desc: 'Create meetings in place with attendees, times, and project links — no separate calendar app required.' },
  { title: 'Schedule Phase', desc: 'A dedicated Schedule phase keeps meeting planning separate from build and run work.' },
  { title: 'Agenda Access', desc: 'Open the meeting popout from scheduled events for agendas, insights, and join links.' },
];

export default function SchedulingFeaturePage() {
  return (
    <>
      <StructuredData
        type="WebPage"
        data={{
          name: 'Scheduling | Nucleas',
          description: metadata.description,
          url: `${baseUrl}/features/scheduling`,
          publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl },
        }}
      />
      <StructuredData
        type="BreadcrumbList"
        data={{
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Features', item: `${baseUrl}/features` },
            { '@type': 'ListItem', position: 3, name: 'Scheduling', item: `${baseUrl}/features/scheduling` },
          ],
        }}
      />
      <div className="min-h-screen bg-background">
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
          <div className="relative max-w-4xl mx-auto text-center">
            <AnimateIn>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6">
                Scheduling
              </span>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">
                Schedule in your{' '}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  workspace
                </span>
              </h1>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                Plan meetings on a visual calendar with team availability beside you — all inside the Nucleas Schedule phase.
              </p>
            </AnimateIn>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <AnimateIn>
            <MarketingScreenshotFrame
              className="max-w-6xl"
              alt="Nucleas scheduling workspace with meeting calendar and linked projects"
            >
              <SchedulingScreenshot />
            </MarketingScreenshotFrame>
          </AnimateIn>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-6xl mx-auto">
            <AnimateIn>
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-text-primary">
                  Scheduling built into{' '}
                  <span className="text-primary">your operating system</span>
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
                  📅
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary mb-3">Calendar + capacity together</h2>
                  <p className="text-text-secondary leading-relaxed">
                    Most tools make you switch between a calendar and a workload view. Nucleas puts both on screen while you schedule — so you can see meetings and team utilization in one place.
                  </p>
                </div>
              </div>
            </AnimateIn>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-4">
            <Link
              href="/features/meetings"
              className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium"
            >
              Explore Meetings →
            </Link>
            <Link
              href="/features/team"
              className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium"
            >
              Explore Team →
            </Link>
          </div>
        </section>

        <MarketingTrialCta title="Start scheduling in Nucleas" />
      </div>
    </>
  );
}
