'use client';

interface PeriodNavButtonProps {
  direction: 'prev' | 'next';
  onClick: () => void;
  'aria-label'?: string;
  className?: string;
}

export default function PeriodNavButton({
  direction,
  onClick,
  'aria-label': ariaLabel,
  className = '',
}: PeriodNavButtonProps) {
  const label = ariaLabel ?? (direction === 'prev' ? 'Previous period' : 'Next period');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`
        inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
        border border-border bg-background-elevated text-text-primary
        transition-colors
        hover:border-primary/50 hover:bg-background-card
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
        disabled:cursor-not-allowed disabled:opacity-50
        ${className}
      `.trim()}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        {direction === 'prev' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        )}
      </svg>
    </button>
  );
}
