'use client';

import Link from 'next/link';
import { useState } from 'react';
import AnimateIn from '@/components/home/AnimateIn';
import HomeFAQ from '@/components/home/HomeFAQ';
import MarketingScreenshotFrame from '@/components/marketing/screenshots/MarketingScreenshotFrame';
import HeroWorkspaceScreenshot from '@/components/marketing/screenshots/HeroWorkspaceScreenshot';

/* ─── Feature category cards for the overview section ─── */
const CATEGORIES = [
  {
    title: 'Projects',
    desc: 'Manage projects end-to-end with tasks, timelines, team assignments, and AI-powered time estimation.',
    href: '/features/projects',
    icon: (
      <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Tasks',
    desc: 'Break down projects into clear tasks with status tracking, recurrence, linked assets, and assignments.',
    href: '/features/tasks',
    icon: (
      <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Content',
    desc: 'Plan, schedule, and distribute content across channels with targeting, assets, and team assignments.',
    href: '/features/content',
    icon: (
      <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    title: 'Meetings',
    desc: 'Walk into calls with project context, agendas, insights, and one-click join.',
    href: '/features/meetings',
    icon: (
      <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Scheduling',
    desc: 'Plan meetings on a workspace calendar with team availability and linked projects.',
    href: '/features/scheduling',
    icon: (
      <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Tools',
    desc: 'Built-in screenshot capture, screen recording, smart buttons, and assets linked to your tasks.',
    href: '/features/tools',
    icon: (
      <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Team',
    desc: 'Track capacity, assignments, workload, and roles. See how every project impacts your team.',
    href: '/features/team',
    icon: (
      <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

/* ─── Pain points ─── */
const PAIN_POINTS = [
  { icon: '🔀', title: 'Scattered tools', desc: 'Your projects live in one app, docs in another, tasks in a third. Nothing connects.' },
  { icon: '🔍', title: 'No visibility', desc: 'You can\'t see who\'s overloaded, what\'s behind schedule, or where things stand.' },
  { icon: '🤝', title: 'Team coordination', desc: 'Meetings lack context. Assignments are unclear. Capacity is a guess.' },
];

/* ─── How It Works steps ─── */
const STEPS = [
  { num: '01', title: 'Build', desc: 'Set up your projects, define tasks, assign your team, and estimate timelines with AI.', color: 'from-primary to-primary/60' },
  { num: '02', title: 'Organize', desc: 'Link assets, documents, and tools to every project. Everything in one place, always.', color: 'from-accent to-accent/60' },
  { num: '03', title: 'Operate', desc: 'Run meetings with context, track progress, manage capacity, and ship consistently.', color: 'from-nucleas-fourth to-nucleas-fourth/60' },
];

/* ─── Differentiators ─── */
const DIFFERENTIATORS = [
  { vs: 'Project Managers', us: 'They track tasks.', nucleas: 'We run businesses.', desc: 'Nucleas goes beyond task tracking — it connects your projects, team, content, meetings, and tools into a single operating layer.' },
  { vs: 'Wikis & Docs', us: 'They store information.', nucleas: 'We connect it to action.', desc: 'Every asset, document, and note in Nucleas is linked to a project, task, or content item — not buried in a folder.' },
  { vs: 'Spreadsheets', us: 'They organize data.', nucleas: 'We organize operations.', desc: 'Stop managing your business in rows and columns. Nucleas gives you purpose-built views for every aspect of your work.' },
];

/* ─── Feature highlights ─── */
const HIGHLIGHTS = [
  { title: 'AI Time Estimation', desc: 'Get intelligent hour estimates for tasks and content. Just describe the work — AI handles the rest.', icon: '🤖' },
  { title: 'Smart Buttons', desc: 'Launch hosting, analytics, docs, design tools, and more in one click from any project.', icon: '⚡' },
  { title: 'Color & Font Tracking', desc: 'Store brand color palettes and font families directly on each project. Always accessible.', icon: '🎨' },
  { title: 'Screenshot & Recording', desc: 'Capture your screen and record video directly inside Nucleas. Save and link to projects.', icon: '📸' },
  { title: 'Team Capacity', desc: 'See how assignments impact each team member. Set weekly hours and track utilization.', icon: '📊' },
  { title: 'Recurring Tasks', desc: 'Set up recurring tasks and content for repeated work. Never forget a regular deliverable.', icon: '🔄' },
];

/* ─── Audience ─── */
const AUDIENCES = [
  { label: 'Startup Studios', desc: 'Manage multiple products and ventures from one dashboard.' },
  { label: 'Digital Agencies', desc: 'Organize client projects, team capacity, and deliverables.' },
  { label: 'Indie Founders', desc: 'Run your solo business with the tools of a full team.' },
  { label: 'SaaS Teams', desc: 'Coordinate development, content, and operations in one place.' },
  { label: 'Niche Site Operators', desc: 'Track content, SEO, and site operations at scale.' },
];

export default function HomePageClient({
  trialPricingLine = 'Free trial available on eligible plans.',
  trialCtaLabel = 'Get Started',
}: {
  trialPricingLine?: string;
  trialCtaLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[80vh] sm:min-h-[95vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-float pointer-events-none" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-float pointer-events-none" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-nucleas-fourth/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center z-10">
          {/* Badge */}
          <AnimateIn>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              The Business Management Layer
            </span>
          </AnimateIn>

          {/* Heading */}
          <AnimateIn>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary tracking-tight leading-[1.1] mb-6">
              The smart operating system for{' '}
              <span className="bg-gradient-to-r from-primary via-[#007bff] to-accent bg-clip-text text-transparent">
                building and running
              </span>{' '}
              a business
            </h1>
          </AnimateIn>

          {/* Subheading */}
          <AnimateIn>
            <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-3 leading-relaxed">
              We&apos;re not another project manager. Nucleas is the business management layer that brings it all together.
            </p>
          </AnimateIn>

          <AnimateIn>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary/80 mb-10">
              Build · Organize · Operate
            </p>
          </AnimateIn>

          {/* CTAs */}
          <AnimateIn>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/register"
                className="inline-flex items-center px-8 py-4 rounded-xl bg-primary text-nucleas-ink font-semibold text-lg hover:bg-primary-hover transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:translate-y-[-1px]"
              >
                Start Your 14-Day Free Trial
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-white/15 text-text-primary font-semibold text-lg hover:bg-white/5 transition-all duration-200"
              >
                See How It Works
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </a>
            </div>
          </AnimateIn>

          {/* Hero image */}
          <AnimateIn>
            <div className="mt-16">
              <MarketingScreenshotFrame
                glow="primary"
                className="shadow-black/40"
                alt="Nucleas workspace dashboard showing project management, team assignments, and planning tools"
              >
                <HeroWorkspaceScreenshot />
              </MarketingScreenshotFrame>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ═══════════════════════ PROBLEM STATEMENT ═══════════════════════ */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">The Problem</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-4">
                You&apos;re running a business, not just managing projects
              </h2>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                Your work spans projects, people, content, meetings, and dozens of tools. But nothing connects them.
              </p>
            </div>
          </AnimateIn>

          <div className="grid md:grid-cols-3 gap-6">
            {PAIN_POINTS.map((point, i) => (
              <AnimateIn key={point.title}>
                <div className="bg-background-card border border-border rounded-2xl p-8 hover:border-red-500/30 transition-all duration-300 h-full hover:-translate-y-1">
                  <span className="text-3xl mb-4 block" role="img" aria-label={point.title + " icon"}>{point.icon}</span>
                  <h3 className="text-xl font-semibold text-text-primary mb-2">{point.title}</h3>
                  <p className="text-text-secondary">{point.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ POSITIONING ═══════════════════════ */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-background-card/50">
        <div className="max-w-5xl mx-auto text-center">
          <AnimateIn>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent mb-3">The Solution</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-6">
              Nucleas is the layer that{' '}
              <span className="bg-gradient-to-r from-accent to-nucleas-fourth bg-clip-text text-transparent">
                connects everything
              </span>
            </h2>
            <p className="text-lg text-text-secondary max-w-3xl mx-auto mb-12">
              Projects, tasks, content, meetings, team capacity, and tools — all wired together in one operating system.
              Not replacing your tools, but connecting them.
            </p>
          </AnimateIn>

          {/* Connection diagram */}
          <AnimateIn>
            <div className="relative max-w-lg mx-auto">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl" />
              </div>
              <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-4">
                {['Projects', 'Tasks', 'Content', 'Meetings', 'Team', 'Tools'].map((label, i) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background-card border border-border hover:border-primary/40 transition-all duration-300 hover:translate-y-[-2px]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-lg">
                      {['📁', '✅', '📝', '📹', '👥', '⚡'][i]}
                    </div>
                    <span className="text-sm font-medium text-text-primary">{label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-primary/40" />
                <span className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-semibold text-primary">
                  Connected by Nucleas
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-primary/40" />
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ═══════════════════════ FEATURE CATEGORIES ═══════════════════════ */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">Platform</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-4">
                Everything you need to run your business
              </h2>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                Seven integrated modules that work together as one operating system.
              </p>
            </div>
          </AnimateIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CATEGORIES.map((cat) => (
              <AnimateIn key={cat.title}>
                <Link
                  href={cat.href}
                  className="group block bg-background-card border border-border rounded-2xl p-8 hover:border-primary/30 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg hover:shadow-primary/5 h-full"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5 group-hover:bg-primary/20 transition-colors">
                    {cat.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary mb-2 group-hover:text-primary transition-colors">
                    {cat.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{cat.desc}</p>
                  <span className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Learn more →
                  </span>
                </Link>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ HOW IT WORKS ═══════════════════════ */}
      <section id="how-it-works" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-background-card/50">
        <div className="max-w-5xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">How It Works</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-4">
                Build. Organize. Operate.
              </h2>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                Three phases. One system. Total clarity.
              </p>
            </div>
          </AnimateIn>

          <div className="space-y-8">
            {STEPS.map((step) => (
              <AnimateIn key={step.num}>
                <div className="flex gap-6 md:gap-10 items-start">
                  <div className={`flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                    {step.num}
                  </div>
                  <div className="pt-2">
                    <h3 className="text-2xl font-bold text-text-primary mb-2">{step.title}</h3>
                    <p className="text-text-secondary text-lg">{step.desc}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ DIFFERENTIATORS ═══════════════════════ */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">Why Nucleas</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary">
                Not another tool.{' '}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  The layer above them.
                </span>
              </h2>
            </div>
          </AnimateIn>

          <div className="grid md:grid-cols-3 gap-6">
            {DIFFERENTIATORS.map((d) => (
              <AnimateIn key={d.vs}>
                <div className="bg-background-card border border-border rounded-2xl p-8 h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/30">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">vs. {d.vs}</p>
                  <p className="text-text-secondary mb-1">{d.us}</p>
                  <p className="text-xl font-bold text-primary mb-4">{d.nucleas}</p>
                  <p className="text-sm text-text-secondary leading-relaxed">{d.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FEATURE HIGHLIGHTS ═══════════════════════ */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-background-card/50">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-wider text-accent mb-3">Highlights</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary">
                Features that set Nucleas apart
              </h2>
            </div>
          </AnimateIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {HIGHLIGHTS.map((h) => (
              <AnimateIn key={h.title}>
                <div className="bg-background border border-border rounded-2xl p-6 hover:border-primary/20 transition-all duration-300 h-full hover:-translate-y-1">
                  <span className="text-2xl mb-3 block" role="img" aria-label={h.title + " icon"}>{h.icon}</span>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">{h.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{h.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ WHO IT'S FOR ═══════════════════════ */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-background-card/50">
        <div className="max-w-5xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">Built For</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-4">
                Who uses Nucleas?
              </h2>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                If you&apos;re running more than one project, product, or client — you need Nucleas.
              </p>
            </div>
          </AnimateIn>

          <div className="flex flex-wrap justify-center gap-4">
            {AUDIENCES.map((a) => (
              <AnimateIn key={a.label}>
                <div className="bg-background border border-border rounded-2xl px-6 py-4 hover:border-primary/30 transition-all duration-300 max-w-xs hover:-translate-y-1">
                  <h3 className="text-base font-semibold text-text-primary mb-1">{a.label}</h3>
                  <p className="text-sm text-text-secondary">{a.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PRICING PREVIEW ═══════════════════════ */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <AnimateIn>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              Simple, seat-based pricing
            </h2>
            <p className="text-lg text-text-secondary mb-3">
              Every plan includes the full platform. No feature gates.
            </p>
            <p className="text-primary font-semibold mb-8">
              {trialPricingLine}
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-primary/30 text-primary font-semibold text-lg hover:bg-primary/5 transition-all duration-200"
            >
              View Pricing
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* ═══════════════════════ FAQ ═══════════════════════ */}
      <HomeFAQ />

      {/* ═══════════════════════ FINAL CTA ═══════════════════════ */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-nucleas-fourth/10 border border-primary/20 p-10 md:p-16 text-center">
            <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <AnimateIn>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-4">
                  Ready to run your business from one place?
                </h2>
                <p className="text-lg text-text-secondary mb-8 max-w-xl mx-auto">
                  Join teams who stopped juggling tools and started operating their business from a single system.
                </p>
                <Link
                  href="/register"
                  className="inline-flex items-center px-10 py-4 rounded-xl bg-primary text-nucleas-ink font-semibold text-lg hover:bg-primary-hover transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-primary/40"
                >
                  {trialCtaLabel}
                </Link>
                <p className="mt-4 text-sm text-text-muted">
                  Full platform access on eligible plans
                </p>
              </AnimateIn>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
