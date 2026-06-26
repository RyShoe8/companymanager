import { cn } from '@/lib/utils';
import { PAGE_GUTTER_CLASS } from '@/lib/ui/mobileLayout';

type MarketingSectionProps = {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** When true, renders a darker background variant for alternating sections. */
  dark?: boolean;
};

export default function MarketingSection({
  children,
  className,
  id,
  dark = false,
}: MarketingSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        PAGE_GUTTER_CLASS,
        dark && 'bg-gradient-to-b from-background-card/50 to-transparent',
        className
      )}
    >
      <div className="max-w-7xl mx-auto">{children}</div>
    </section>
  );
}
