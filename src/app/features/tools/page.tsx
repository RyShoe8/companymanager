import Link from 'next/link';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata = {
  title: 'Tools — Your Built-In Operating System',
  description: 'Built-in screenshot capture, screen recording, smart buttons, and centralized asset management. Nucleas OS tools eliminate context switching and keep everything linked to your projects.',
  keywords: ['screenshot tool', 'screen recording', 'smart buttons', 'asset management', 'business tools', 'productivity tools'],
  alternates: { canonical: '/features/tools' },
  openGraph: { title: 'Tools — Your Built-In Operating System | Nucleas', description: 'Screenshot capture, recordings, smart buttons, and asset management.', url: `${baseUrl}/features/tools`, type: 'website' as const },
  twitter: { card: 'summary_large_image' as const, title: 'Tools | Nucleas' },
};

const FEATURES = [
  { title: 'Screenshot Capture', desc: 'Capture screenshots directly within Nucleas. No third-party tools needed — capture, annotate, and save in one workflow.' },
  { title: 'Screenshot Gallery', desc: 'View, organize, and manage all captured screenshots. Browse by project, search by name, and link screenshots to tasks and content.' },
  { title: 'Recording Capture', desc: 'Record your screen and audio directly inside Nucleas. Create walkthroughs, bug reports, and training videos without leaving the platform.' },
  { title: 'Recording Management', desc: 'Save, organize, name, and access all your recordings. Link recordings to specific projects, tasks, and content items.' },
  { title: 'Asset Linking', desc: 'Link any asset — screenshots, recordings, documents — to projects, tasks, and content items. Build a web of connected resources.' },
  { title: 'Smart Buttons', desc: 'One-click launch buttons for hosting, analytics, design tools, documentation, billing, and marketing platforms. Every project gets its own control panel.' },
];

export default function ToolsFeaturePage() {
  return (
    <>
      <StructuredData type="WebPage" data={{ name: 'Tools | Nucleas', description: metadata.description, url: `${baseUrl}/features/tools`, publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl } }} />
      <StructuredData type="BreadcrumbList" data={{ itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }, { '@type': 'ListItem', position: 2, name: 'Features', item: `${baseUrl}/features` }, { '@type': 'ListItem', position: 3, name: 'Tools', item: `${baseUrl}/features/tools` }] }} />
      <div className="min-h-screen bg-background">
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-28"><div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" /><div className="relative max-w-4xl mx-auto text-center"><AnimateIn><span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-sm font-medium text-accent mb-6">Nucleas OS</span><h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">Your built-in{' '}<span className="bg-gradient-to-r from-accent to-nucleas-fourth bg-clip-text text-transparent">operating system</span></h1><p className="text-lg text-text-secondary max-w-2xl mx-auto">Screenshots, recordings, smart buttons, and asset management — all built in. No more switching between apps to capture, record, and organize.</p></AnimateIn></div></section>
        <section className="px-4 sm:px-6 lg:px-8 pb-16"><AnimateIn><div className="max-w-4xl mx-auto relative"><div className="absolute -inset-4 bg-gradient-to-r from-accent/20 via-nucleas-fourth/10 to-accent/20 rounded-2xl blur-xl opacity-40" /><div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl"><img src="/images/marketing/features-tools.png" alt="Nucleas built-in tools including screenshot capture, recordings, and smart buttons" className="w-full h-auto" loading="eager" /></div></div></AnimateIn></section>
        <section className="px-4 sm:px-6 lg:px-8 py-20"><div className="max-w-6xl mx-auto"><AnimateIn><div className="text-center mb-16"><h2 className="text-3xl sm:text-4xl font-bold text-text-primary">Built-in <span className="text-accent">tools</span> for every workflow</h2></div></AnimateIn><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{FEATURES.map((f) => (<AnimateIn key={f.title}><div className="bg-background-card border border-border rounded-2xl p-6 hover:border-accent/30 transition-all duration-300 hover:translate-y-[-2px] h-full"><h3 className="text-base font-semibold text-text-primary mb-2">{f.title}</h3><p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p></div></AnimateIn>))}</div></div></section>
        <section className="px-4 sm:px-6 lg:px-8 py-20 bg-background-card/50"><div className="max-w-4xl mx-auto"><AnimateIn><div className="flex flex-col md:flex-row gap-8 items-center"><div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-nucleas-fourth flex items-center justify-center text-3xl">⚡</div><div><h2 className="text-2xl font-bold text-text-primary mb-3">Smart Buttons</h2><p className="text-text-secondary leading-relaxed">Every project in Nucleas gets customizable action buttons for hosting panels, analytics dashboards, design tools, documentation, billing portals, and marketing platforms. One click launches the exact tool you need — no more hunting through bookmarks, browser tabs, or password managers. Your entire tool stack, organized by project.</p></div></div></AnimateIn></div></section>
        <section className="px-4 sm:px-6 lg:px-8 py-16"><div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-4"><Link href="/features/projects" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Projects →</Link><Link href="/features/efficiency" className="px-6 py-3 rounded-xl border border-border text-text-secondary hover:text-primary hover:border-primary/30 transition-all text-sm font-medium">Explore Efficiency →</Link></div></section>
        <section className="px-4 sm:px-6 lg:px-8 pb-20"><div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent/10 via-nucleas-fourth/10 to-primary/10 border border-accent/20 p-10 md:p-16 text-center"><div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" /><div className="relative"><h2 className="text-3xl font-bold text-text-primary mb-4">Try the built-in tools</h2><p className="text-text-secondary mb-8">Capture screenshots free — no account required. Or start a 14-day trial to save assets to your projects.</p><div className="flex flex-wrap justify-center gap-4"><Link href="/tools/screenshot" className="inline-flex items-center px-8 py-4 rounded-xl border border-border text-text-primary font-semibold text-lg hover:border-primary/40 transition-all">Try Free Screenshot Tool</Link><Link href="/register" className="inline-flex items-center px-8 py-4 rounded-xl bg-primary text-nucleas-ink font-semibold text-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/25">Start Your 14-Day Free Trial</Link></div></div></div></section>
      </div>
    </>
  );
}
