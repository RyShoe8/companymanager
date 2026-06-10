interface SeriesPositionBadgeProps {
  index: number;
  total: number;
  className?: string;
}

export default function SeriesPositionBadge({
  index,
  total,
  className = 'text-xs text-gray-400 italic leading-none',
}: SeriesPositionBadgeProps) {
  return (
    <span className={className} aria-label={`Series item ${index} of ${total}`}>
      {index}/{total}
    </span>
  );
}
