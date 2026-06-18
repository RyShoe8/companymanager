import Link from 'next/link';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'About Nucleas — The Business Management Layer',
  description: 'Nucleas is the smart operating system for building and running a business. Not another project manager — the management layer that connects projects, team, content, meetings, and tools.',
  keywords: ['about Nucleas', 'business operating system', 'company mission', 'business management'],
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Nucleas — The Business Management Layer',
    description: 'The smart operating system for building and running a business.',
    url: `${baseUrl}/about`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: 'About | Nucleas',
    description: 'The smart operating system for building and running a business.',
  },
};

const VALUES = [
  { title: 'Simplicity', desc: 'One platform, not ten tools. We believe the best software disappears into your workflow, not complicates it.', icon: '✨' },
  { title: 'All-in-One', desc: 'Every feature included in every plan. Seat-based pricing means your whole team gets the full platform.', icon: '🔗' },
  { title: 'Team-First', desc: 'Built for teams who build together. Capacity tracking, role management, and collaboration are core, not afterthoughts.', icon: '👥' },
];

export default function AboutPage() {
  return (
    <>
      <StructuredData type="WebPage" data={{ '@type': 'AboutPage', name: 'About Nucleas', description: metadata.description, url: `${baseUrl}/about`, publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl } }} />
      <StructuredData type="BreadcrumbList" data={{ itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }, { '@type': 'ListItem', position: 2, name: 'About', item: `${baseUrl}/about` }] }} />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
          <div className="absolute top-1/3 -left-32 w-80 h-80 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-4xl mx-auto text-center">
            <AnimateIn>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-sm font-medium text-accent mb-6">Company</span>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">
                The smart operating system for{' '}
                <span className="bg-gradient-to-r from-primary via-[#007bff] to-accent bg-clip-text text-transparent">
                  building and running a business
                </span>
              </h1>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                Build. Organize. Operate.
              </p>
            </AnimateIn>
          </div>
        </section>

        {/* Mission */}
        <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-3xl mx-auto">
            <AnimateIn>
              <div className="bg-background-card border border-border rounded-2xl p-8 md:p-12">
                <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-6">Our Mission</h2>
                <p className="text-text-secondary leading-relaxed mb-4 text-lg">
                  We&apos;re not another project manager — we&apos;re the management layer that brings it all together.
                </p>
                <p className="text-text-secondary leading-relaxed mb-4">
                  Nucleas connects your projects, clients, team, content, meetings, and tools into one operating system.
                  Instead of juggling ten different apps and losing context between them, you run everything from a single platform
                  that understands how all the pieces of your business fit together.
                </p>
                <p className="text-text-secondary leading-relaxed">
                  We believe that running a business should feel organized, not chaotic. That your tools should work together,
                  not against each other. And that your team should spend time doing great work, not searching for information.
                </p>
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* Origin Story */}
        <section className="px-4 sm:px-6 lg:px-8 py-20 bg-background-card/50">
          <div className="max-w-3xl mx-auto">
            <AnimateIn>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-4">Why We Built This</p>
              <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-6">
                Running a business means more than managing tasks
              </h2>
              <p className="text-text-secondary leading-relaxed mb-4">
                We built Nucleas because we lived the problem. Managing multiple projects meant switching between
                project boards, document editors, calendar apps, analytics dashboards, and spreadsheets — dozens of tabs,
                none of them talking to each other.
              </p>
              <p className="text-text-secondary leading-relaxed mb-4">
                Every meeting started with &quot;let me find the link.&quot; Every status update required pulling data from three places.
                Every new team member took weeks to understand where everything lived.
              </p>
              <p className="text-text-secondary leading-relaxed">
                Nucleas is the operating system we wished existed — a single place where projects, people, content, meetings,
                and tools are all connected. Not replacing your existing tools, but connecting them into one coherent system.
              </p>
            </AnimateIn>
          </div>
        </section>

        {/* Values */}
        <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-5xl mx-auto">
            <AnimateIn>
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-text-primary">What we believe</h2>
              </div>
            </AnimateIn>
            <div className="grid md:grid-cols-3 gap-6">
              {VALUES.map((v) => (
                <AnimateIn key={v.title}>
                  <div className="bg-background-card border border-border rounded-2xl p-8 text-center h-full">
                    <span className="text-3xl mb-4 block">{v.icon}</span>
                    <h3 className="text-xl font-semibold text-text-primary mb-3">{v.title}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{v.desc}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="px-4 sm:px-6 lg:px-8 py-20 bg-background-card/50">
          <div className="max-w-3xl mx-auto text-center">
            <AnimateIn>
              <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-4">Get in Touch</h2>
              <p className="text-text-secondary mb-2">
                Have questions or feedback? We&apos;d love to hear from you.
              </p>
              <p className="text-text-secondary mb-8">
                Email us at{' '}
                <a href="mailto:theteam@nucleas.app" className="text-primary hover:text-primary-hover transition-colors font-medium">
                  theteam@nucleas.app
                </a>
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center px-8 py-3.5 rounded-xl border-2 border-primary/30 text-primary font-semibold hover:bg-primary/5 transition-all"
              >
                Contact Us
              </Link>
            </AnimateIn>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-nucleas-fourth/10 border border-primary/20 p-10 md:p-16 text-center">
            <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
            <div className="relative">
              <AnimateIn>
                <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">Ready to try Nucleas?</h2>
                <p className="text-lg text-text-secondary mb-8 max-w-xl mx-auto">
                  Free trial available on eligible plans. Full platform access.
                </p>
                <Link href="/register" className="inline-flex items-center px-8 py-4 rounded-xl bg-primary text-nucleas-ink font-semibold text-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/25">
                  Start Your 14-Day Free Trial
                </Link>
              </AnimateIn>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
