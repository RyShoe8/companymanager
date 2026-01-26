'use client';

interface ReviewRequestBadgeProps {
  count?: number;
  className?: string;
}

export default function ReviewRequestBadge({ count = 0, className = '' }: ReviewRequestBadgeProps) {
  if (count === 0) return null;

  return (
    <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-yellow-500 rounded-full ${className}`}>
      {count}
    </span>
  );
}
