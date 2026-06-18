import React from 'react';

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyStateIllustration({ title, description, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-background-card border border-border/50 shadow-inner">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
        <svg className="w-32 h-32 text-primary opacity-80 relative z-10 animate-float" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary text-sm max-w-sm mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="relative inline-flex items-center px-6 py-2.5 rounded-full border border-primary/30 bg-primary/10 text-primary font-semibold text-sm hover:bg-primary hover:text-nucleas-ink transition-all duration-300 group overflow-hidden shadow-lg shadow-primary/10 hover:shadow-primary/30"
        >
          <span className="relative z-10">{actionLabel}</span>
          <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        </button>
      )}
    </div>
  );
}
