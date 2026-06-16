import Link from 'next/link';
import { MarketingTrialCta } from '@/components/marketing/MarketingTrialCta';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';
import MarketingScreenshotFrame from '@/components/marketing/screenshots/MarketingScreenshotFrame';
import ContentModalScreenshot from '@/components/marketing/screenshots/ContentModalScreenshot';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Content — Plan, Create, Distribute',
  description: 'Plan, schedule, and distribute content across channels. Target audiences, link assets, and coordinate content creation with your team inside Nucleas.',
  keywords: ['content planning', 'content scheduling', 'content management', 'content calendar', 'content distribution'],
  alternates: { canonical: '/features/content' },
  openGraph: { title: 'Content — Plan, Create, Distribute | Nucleas', description: 'Content planning and scheduling across channels.', url: `${baseUrl}/features/content`, type: 'website' as const },
  twitter: { card: 'summary_large_image' as const, title: 'Content | Nucleas' },
};

const FEATURES = [
  { title: 'Content Items', desc: 'Create and manage content items with detailed information including title, body, target audience, and distribution channels.' },
  { title: 'Content Targeting', desc: 'Define your target audience, keywords, and messaging for each content piece. Keep your content strategy focused and measurable.' },
  { title: 'Content Channels', desc: 'Organize content by channel or platform — blog, social media, email, video, and more. See all content for any channel at a glance.' },
  { title: 'Content Linked Assets', desc: 'Link screenshots, recordings, documents, and other assets directly to content items. Everything your creators need, attached to the work.' },
  { title: 'Content Scheduling', desc: 'Schedule content items for specific dates and times. See your content calendar alongside project timelines on the planning map.' },
  { title: 'Quick Content Creation', desc: 'Fast content item creation with a streamlined modal interface. Add new content without leaving your current view.' },
  { title: 'Content Detail View', desc: 'Comprehensive detail view for editing content items with all fields, linked assets, targeting info, and scheduling in one place.' },
  { title: 'Content Assets Section', desc: 'Dedicated section for managing content-related assets. Upload, link, and organize files specific to each content piece.' },
  { title: 'Content Channel Filter', desc: 'Filter content by channel for focused viewing. Quickly switch between channels to see what\'s planned, in progress, and published.' },
];

export default function ContentFeaturePage() {
  return (
    <>
      <StructuredData type="WebPage" data={{ name: 'Content | Nucleas', description: metadata.description, url: `${baseUrl}/features/content`, publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl } }} />
      <StructuredData type="BreadcrumbList" data={{ itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }, { '@type': 'ListItem', position: 2, name: 'Features', item: `${baseUrl}/features` }, { '@type': 'ListItem', position: 3, name: 'Content', item: `${baseUrl}/features/content` }] }} />
      <div className="min-h-screen bg-background">
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-28"><div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" /><div className="relative max-w-4xl mx-auto text-center"><AnimateIn><span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-6">Content</span><h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">Plan, create,{' '}<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">distribute</span></h1><p className="text-lg text-text-secondary max-w-2xl mx-auto">Plan, schedule, and distribute content across channels with targeting, linked assets, and team coordination.</p></AnimateIn></div></section>
        <section className="px-4 sm:px-6 lg:px-8 pb-16"><AnimateIn><MarketingScreenshotFrame glow="accent" alt="Nucleas content detail modal with channel, scheduling, and targeting fields"><ContentModalScreenshot /></MarketingScreenshotFrame></AnimateIn></section>
        <section className="px-4 sm:px-6 lg:px-8 py-20"><div className="max-w-6xl mx-auto"><AnimateIn><div className="text-center mb-16"><h2 className="text-3xl sm:text-4xl font-bold text-text-primary">Complete <span className="text-primary">content management</span></h2></div></AnimateIn><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{FEATURES.map((f) => (<AnimateIn key={f.title}><div className="bg-background-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 hover:translate-y-[-2px] h-full"><h3 className="text-base font-semibold text-text-primary mb-2">{f.title}</h3><p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p></div></AnimateIn>))}</div></div></section>
        <section className="px-4 sm:px-6 lg:px-8 py-20 bg-background-card/50"><div className="max-w-4xl mx-auto"><AnimateIn><div className="flex flex-col md:flex-row gap-8 items-center"><div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl">📅</div><div><h2 className="text-2xl font-bold text-text-primary mb-3">Content Scheduling</h2><p className="text-text-secondary leading-relaxed">Schedule content for specific dates and see it alongside your project timelines on the planning map. Plan weeks or months ahead, coordinate publishing across channels, and ensure your content strategy stays on track. Your team always knows what&apos;s coming next.</p></div></div></AnimateIn></div></section>
        <section className="px-4 sm:px-6 lg:px-8 py-16"><div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-4"><Link href="/features/projects" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Projects →</Link><Link href="/features/tasks" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Tasks →</Link></div></section>
        <MarketingTrialCta title="Start planning your content" />
      </div>
    </>
  );
}
