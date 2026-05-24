'use client';

interface HoverDeleteButtonProps {
  onClick: (e: React.MouseEvent) => void;
  label?: string;
}

export default function HoverDeleteButton({ onClick, label = 'Delete' }: HoverDeleteButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 touch-manipulation"
      aria-label={label}
    >
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
