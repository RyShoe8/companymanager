'use client';

import { useState } from 'react';
import AnimateIn from '@/components/home/AnimateIn';
import type { FAQItem } from '@/data/faq';

function FaqAccordionItem({
  item,
  index,
  isOpen,
  onToggle,
  idPrefix,
}: {
  item: FAQItem;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  idPrefix: string;
}) {
  const questionId = `${idPrefix}-question-${index}`;
  const answerId = `${idPrefix}-answer-${index}`;

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
        aria-controls={answerId}
        id={questionId}
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
        id={answerId}
        role="region"
        aria-labelledby={questionId}
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

interface MarketingFaqProps {
  items: FAQItem[];
  id?: string;
  badge?: string;
  heading: string;
  subtitle?: string;
  variant?: 'dark' | 'light';
}

export default function MarketingFaq({
  items,
  id = 'faq',
  badge = 'FAQ',
  heading,
  subtitle,
  variant = 'dark',
}: MarketingFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const isDark = variant === 'dark';

  return (
    <section
      id={id}
      className={`relative py-20 md:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden ${
        isDark ? '' : 'bg-background-card/50'
      }`}
    >
      {isDark && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
          <div className="absolute top-1/4 -right-32 w-[400px] h-[400px] rounded-full bg-primary/15 blur-[100px] animate-float" />
          <div
            className="absolute bottom-1/4 -left-32 w-[300px] h-[300px] rounded-full bg-secondary/15 blur-[80px] animate-float"
            style={{ animationDelay: '-3s' }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0f172a_60%)]" />
        </>
      )}

      <div className="relative max-w-3xl mx-auto">
        <AnimateIn>
          {badge && (
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-6 ${
                isDark ? 'bg-white/10 text-slate-300' : 'bg-primary/10 text-primary border border-primary/20'
              }`}
            >
              {badge}
            </span>
          )}
          <h2
            className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight ${
              isDark ? 'text-white' : 'text-text-primary'
            }`}
          >
            {heading}
          </h2>
          {subtitle && (
            <p className={`text-xl mb-12 ${isDark ? 'text-slate-400' : 'text-text-secondary'}`}>
              {subtitle}
            </p>
          )}
        </AnimateIn>
        <div className="space-y-4">
          {items.map((item, index) => (
            <AnimateIn key={item.question} delay={index * 50}>
              <FaqAccordionItem
                item={item}
                index={index}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
                idPrefix={id}
              />
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
