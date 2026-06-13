import { cn } from '@/lib/utils';

type FeatureCardProps = {
  /** Render any icon element — SVG, emoji, or Lucide component. */
  iconSlot: React.ReactNode;
  title: string;
  description: string;
  className?: string;
};

export default function FeatureCard({
  iconSlot,
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        'bg-background-card border border-border rounded-2xl p-6',
        'hover:border-primary/30 hover:translate-y-[-2px] hover:shadow-lg hover:shadow-primary/5',
        'transition-all duration-300 group',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
        {iconSlot}
      </div>

      <h3 className="text-lg font-semibold text-text-primary mb-2 group-hover:text-primary transition-colors duration-300">
        {title}
      </h3>

      <p className="text-sm leading-relaxed text-text-secondary">
        {description}
      </p>
    </div>
  );
}
