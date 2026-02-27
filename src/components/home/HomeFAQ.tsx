'use client';

import { useState } from 'react';
import AnimateIn from '@/components/home/AnimateIn';

export type FAQItem = { question: string; answer: string };

const FAQ_DATA: FAQItem[] = [
  {
    question: 'What is Nucleas?',
    answer: 'Nucleas is the operating system for planning, building, and running every project you own. It\'s a single command center where you manage projects across Plan, Build, and Run phases—with a visual planning map, tasks, assets, team capacity, and one-click buttons to your tools (hosting, analytics, docs, and more).',
  },
  {
    question: 'Who is Nucleas for?',
    answer: 'Nucleas is built for people running multiple projects: startup studios, indie founders, agencies, builders, operators, niche site owners, and SaaS teams. If you\'re running more than one thing—products, sites, clients, experiments, or revenue streams—you need a hub. Nucleas keeps everything in one place instead of scattered across dashboards, docs, and spreadsheets.',
  },
  {
    question: 'How does the free tier work?',
    answer: 'You can run one project with full features for free. No credit card required. When you need multiple projects, team workspaces, shared access, or advanced features, you can upgrade. Pricing is simple with no per-seat complexity.',
  },
  {
    question: 'What is the interactive demo?',
    answer: 'Type what you want to build (e.g. "launch a SaaS", "run a content site") and we generate a live demo workspace for it. You\'ll see a real planning map, sample projects, and the Plan → Build → Run flow. No signup required. You can convert the demo into a real workspace if you like it.',
  },
  {
    question: 'What are Plan, Build, and Run?',
    answer: 'Every project in Nucleas moves through three phases. Plan is for validating ideas, organizing research, and storing links and decisions. Build is for tracking execution, launching dev/design tools, and centralizing assets. Run is for monitoring analytics, daily operations, and optimizing revenue. The interface adapts to the phase you\'re in.',
  },
  {
    question: 'Does Nucleas replace my existing tools?',
    answer: 'No. Nucleas connects your stack. Each project gets customizable action buttons for hosting, analytics, domains, design, docs, billing, and marketing. You launch anything in one click from the command center instead of hunting through bookmarks and tabs.',
  },
  {
    question: 'How do I get started?',
    answer: 'Sign up for free at nucleas.app/register (Google sign-in). Create your organization, then add your first project. You can try the interactive demo on the homepage first with no account—just type an idea and we\'ll spin up a demo workspace so you can see how Nucleas would run your operation.',
  },
];

function FAQAccordionItem({
  item,
  index,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-2xl border-2 border-border bg-background-card overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
      style={{ transitionProperty: 'border-color, box-shadow' }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${index}`}
        id={`faq-question-${index}`}
      >
        <span className="text-lg font-semibold text-text-primary pr-8">{item.question}</span>
        <span
          className={`flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div
        id={`faq-answer-${index}`}
        role="region"
        aria-labelledby={`faq-question-${index}`}
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-5 pt-0">
            <p className="text-text-secondary leading-relaxed border-t border-border pt-4">
              {item.answer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 md:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
      <div className="absolute top-1/4 -right-32 w-[400px] h-[400px] rounded-full bg-primary/15 blur-[100px] animate-float" />
      <div className="absolute bottom-1/4 -left-32 w-[300px] h-[300px] rounded-full bg-secondary/15 blur-[80px] animate-float" style={{ animationDelay: '-3s' }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0f172a_60%)]" />

      <div className="relative max-w-3xl mx-auto">
        <AnimateIn>
          <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-6">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Questions & answers
          </h2>
          <p className="text-xl text-slate-400 mb-12">
            Everything you need to know about Nucleas.
          </p>
        </AnimateIn>
        <div className="space-y-4">
          {FAQ_DATA.map((item, index) => (
            <AnimateIn key={index} delay={index * 50}>
              <FAQAccordionItem
                item={item}
                index={index}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}

export { FAQ_DATA };
