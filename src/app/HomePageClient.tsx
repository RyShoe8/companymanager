'use client';

import Link from 'next/link';
import Image from 'next/image';
import InteractiveDemoBlock from '@/components/home/InteractiveDemoBlock';
import AnimateIn from '@/components/home/AnimateIn';

export default function HomePageClient() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* HERO - Dark, dramatic */}
      <section className="relative min-h-[95vh] flex items-center overflow-hidden">
        {/* Dark gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 -left-32 w-[400px] h-[400px] rounded-full bg-secondary/20 blur-[100px] animate-float" style={{ animationDelay: '-4s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[80px] animate-pulse" />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />
        {/* Radial gradient vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0f172a_70%)]" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-32 text-center">
          <AnimateIn>
            <div className="flex justify-center mb-10">
              <Image
                src="/images/icon.png"
                alt="Nucleas"
                width={120}
                height={120}
                priority
                unoptimized
                className="h-14 md:h-16 w-auto brightness-0 invert opacity-95"
              />
            </div>
          </AnimateIn>
          <AnimateIn delay={100}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-8 tracking-tight">
              <span className="text-white">Run Your Entire Internet Business</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                From One Command Center
              </span>
            </h1>
          </AnimateIn>
          <AnimateIn delay={200}>
            <p className="text-xl sm:text-2xl text-slate-400 max-w-2xl mx-auto mb-6">
              Stop juggling tabs, tools, and documents.
            </p>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-12">
              Nucleas is the operating system for planning, building, and running every project you own.
            </p>
          </AnimateIn>
          <AnimateIn delay={300}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link
                href="/register"
                className="inline-flex items-center justify-center w-full sm:w-auto px-10 py-4 min-h-[52px] text-base font-semibold rounded-xl bg-primary text-white hover:bg-primary-hover transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                Start Free
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center w-full sm:w-auto px-10 py-4 min-h-[52px] text-base font-semibold rounded-xl border-2 border-white/30 bg-white/5 text-white hover:bg-white/15 hover:border-white/50 transition-all backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                Try the Interactive Demo
              </a>
            </div>
            <p className="text-sm text-slate-500">
              Free for one project. Upgrade when you&apos;re running more.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* INTERACTIVE DEMO - Glowing card */}
      <section id="demo" className="relative py-24 md:py-32 -mt-1">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateIn>
            <div className="relative p-8 md:p-12 rounded-3xl bg-background-card border border-border shadow-2xl shadow-primary/5">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 opacity-50" />
              <div className="relative flex flex-col items-center">
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
                  Core differentiator
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
                  What are you trying to build?
                </h2>
                <InteractiveDemoBlock
                  variant="hero"
                  subtext="We'll spin up a live demo workspace based on your idea and guide you from scratch."
                  buttonText="Generate Demo Workspace →"
                />
              </div>
            </div>
          </AnimateIn>
          <AnimateIn delay={200}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
              {[
                { icon: '📦', text: 'We create a demo workspace' },
                { icon: '🔘', text: 'Pre-load tools & buttons' },
                { icon: '🔄', text: 'Show plan → build → run flow' },
                { icon: '✨', text: 'Option to convert' },
              ].map((step, i) => (
                <div
                  key={i}
                  className="group p-5 rounded-2xl bg-background-card border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 text-center"
                >
                  <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform">{step.icon}</span>
                  <p className="text-sm font-medium text-text-primary">{step.text}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-text-secondary mt-8 text-base max-w-xl mx-auto">
              See exactly how Nucleas would run your project. No setup. No commitment. Just a working command center.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* PROBLEM - Chaos vs order */}
      <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <AnimateIn>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary text-center mb-16 leading-tight">
              Running multiple projects
              <br />
              <span className="text-primary">shouldn&apos;t feel chaotic</span>
            </h2>
          </AnimateIn>
          <AnimateIn delay={100}>
            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
              <div className="p-8 rounded-2xl bg-primary/5 border border-primary/10">
                <p className="text-text-secondary mb-6 font-medium">Most founders operate across:</p>
                <ul className="space-y-3">
                  {['products', 'sites', 'clients', 'experiments', 'revenue streams'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-text-primary font-semibold">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-8 rounded-2xl bg-slate-100 border border-border">
                <p className="text-text-secondary mb-6 font-medium">But everything lives in different places:</p>
                <ul className="space-y-3">
                  {['dashboards', 'docs', 'bookmarks', 'spreadsheets', 'notes'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-text-secondary">
                      <span className="w-2 h-2 rounded-full bg-text-secondary/50" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </AnimateIn>
          <AnimateIn delay={200}>
            <div className="mt-16 p-8 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 text-center">
              <p className="text-2xl md:text-3xl font-bold text-text-primary">
                You don&apos;t need more tools.
              </p>
              <p className="text-2xl md:text-3xl font-bold text-primary mt-2">
                You need a control panel.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* POSITIONING - Bold statement */}
      <section className="py-24 md:py-32 bg-text-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimateIn>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
              Nucleas is the operating system
              <br />
              for modern builders
            </h2>
          </AnimateIn>
          <AnimateIn delay={100}>
            <p className="text-slate-400 text-lg mb-6">
              Not project management. Not a wiki. Not another productivity app.
            </p>
            <p className="text-xl font-semibold text-white mb-10">
              Nucleas is the command center for everything you&apos;re running.
            </p>
          </AnimateIn>
          <AnimateIn delay={200}>
            <div className="flex flex-wrap justify-center gap-6 text-primary font-semibold text-lg">
              <span>Plan ideas.</span>
              <span>Launch builds.</span>
              <span>Operate live projects.</span>
            </div>
            <p className="text-slate-400 mt-6">All from one place.</p>
          </AnimateIn>
        </div>
      </section>

      {/* HOW IT WORKS - Plan Build Run */}
      <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center mb-4">
              Every project moves through three phases
            </h2>
            <p className="text-text-secondary text-center mb-16">The interface adapts to the phase you&apos;re in.</p>
          </AnimateIn>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { label: 'Plan', icon: '📋', color: 'primary', bullets: ['Validate ideas and organize research', 'Store links, docs, and decisions', 'Launch planning tools instantly'] },
              { label: 'Build', icon: '🔨', color: 'success', bullets: ['Track execution', 'Launch dev, design, and infra tools', 'Centralize assets and workflows'] },
              { label: 'Run', icon: '🚀', color: 'secondary', bullets: ['Monitor analytics', 'Operate daily', 'Optimize revenue and performance'] },
            ].map((phase, i) => (
              <AnimateIn key={phase.label} delay={i * 150}>
                <Link
                  href={phase.label === 'Plan' ? '/plan' : phase.label === 'Build' ? '/build' : '/run'}
                  className="group block p-8 rounded-3xl border-2 border-border hover:border-primary bg-background-card transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2"
                >
                  <span className="text-5xl mb-6 block group-hover:scale-110 transition-transform">{phase.icon}</span>
                  <h3 className="text-2xl font-bold text-text-primary mb-6 group-hover:text-primary transition-colors">{phase.label}</h3>
                  <ul className="space-y-3 text-text-secondary">
                    {phase.bullets.map((b) => (
                      <li key={b} className="flex gap-3">
                        <span className="text-primary font-bold">→</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </Link>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* SUPER BUTTON SYSTEM */}
      <section className="py-24 md:py-32 bg-background-card border-y border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center mb-4">
              Your tools. One control panel.
            </h2>
            <p className="text-text-secondary text-center mb-12 text-lg">
              Nucleas doesn&apos;t replace your stack. It connects it.
            </p>
          </AnimateIn>
          <AnimateIn delay={100}>
            <p className="text-text-primary text-center mb-8 font-medium">
              Every project gets customizable action buttons for:
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {['hosting', 'analytics', 'domains', 'design', 'docs', 'billing', 'marketing'].map((tool) => (
                <span key={tool} className="px-5 py-2.5 rounded-xl bg-primary-light text-primary-dark font-semibold text-sm">
                  {tool}
                </span>
              ))}
            </div>
            <p className="text-xl font-semibold text-text-primary text-center">
              Launch anything in one click. No more searching.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* WHY IT EXISTS */}
      <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <AnimateIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center mb-12">
              Why it exists
            </h2>
          </AnimateIn>
          <AnimateIn delay={100}>
            <div className="space-y-6 text-lg">
              <p className="text-text-secondary">
                Nucleas started as our internal system. We were running:
              </p>
              <ul className="space-y-2 text-text-primary font-medium">
                {['client work', 'products', 'experiments', 'analytics platforms'].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-primary">•</span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-text-secondary">Everything was scattered.</p>
              <p className="text-text-primary font-semibold">So we built the command center we wanted.</p>
              <p className="text-primary font-bold text-xl">Now we run our entire company from it. You can too.</p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="py-24 md:py-32 bg-primary/5 border-y border-primary/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary text-center mb-8">
              Who it&apos;s for
            </h2>
          </AnimateIn>
          <AnimateIn delay={100}>
            <p className="text-text-secondary text-center mb-10 text-lg">
              Nucleas is built for people running multiple projects:
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {['startup studios', 'indie founders', 'agencies', 'builders', 'operators', 'niche site owners', 'SaaS teams'].map((audience) => (
                <span key={audience} className="px-5 py-2.5 rounded-full bg-background-card border-2 border-border hover:border-primary/50 text-text-primary font-semibold text-sm transition-colors">
                  {audience}
                </span>
              ))}
            </div>
            <p className="text-text-primary font-semibold text-center mt-10 text-lg">
              If you&apos;re running more than one thing, you need a hub.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* DEMO CTA REPEAT */}
      <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <AnimateIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              Try it with your own idea
            </h2>
            <p className="text-text-secondary mb-10 text-lg">
              Type what you want to build and we&apos;ll generate a live workspace for it.
            </p>
            <InteractiveDemoBlock
              buttonText="Generate Demo Workspace"
              subtext="See how your entire operation would run inside Nucleas."
            />
          </AnimateIn>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-24 md:py-32 bg-background-card border-y border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimateIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              Start free
            </h2>
            <p className="text-text-primary mb-6 text-lg">
              Run one project with full features.
            </p>
            <p className="text-text-secondary mb-6">
              Upgrade when you need: multiple projects, team workspaces, shared access, advanced features.
            </p>
            <p className="text-text-secondary mb-10">
              Simple pricing. No per-seat complexity.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-10 py-4 min-h-[52px] rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Free
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 md:py-32 bg-gradient-to-br from-primary via-primary to-secondary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimateIn>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Stop running your business from memory and bookmarks.
            </h2>
            <p className="text-xl text-white/90 mb-12">
              Run it from Nucleas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center w-full sm:w-auto px-10 py-4 min-h-[52px] text-base font-semibold rounded-xl bg-white text-primary hover:bg-gray-100 transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              >
                Start Free
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center w-full sm:w-auto px-10 py-4 min-h-[52px] text-base font-semibold rounded-xl border-2 border-white/50 bg-white/10 text-white hover:bg-white/20 hover:border-white/80 transition-all backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                Try Interactive Demo
              </a>
            </div>
          </AnimateIn>
        </div>
      </section>
    </div>
  );
}
