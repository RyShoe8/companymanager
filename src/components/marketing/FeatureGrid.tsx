import { cn } from '@/lib/utils';

type FeatureGridProps = {
  children: React.ReactNode;
  /** Number of columns at the largest breakpoint. Default: 3 */
  columns?: 2 | 3 | 4;
  className?: string;
};

const columnClasses = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
} as const;

export default function FeatureGrid({
  children,
  columns = 3,
  className,
}: FeatureGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 gap-6',
        columnClasses[columns],
        className
      )}
    >
      {children}
    </div>
  );
}
