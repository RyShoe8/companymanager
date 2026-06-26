import { cn } from '@/lib/utils';

type GlowVariant = 'primary' | 'accent' | 'mixed';

type MarketingScreenshotFrameProps = {
  children: React.ReactNode;
  glow?: GlowVariant;
  className?: string;
  alt?: string;
  /** When true, touch/click passes through the frame (marketing previews). */
  nonInteractive?: boolean;
};

const glowClasses: Record<GlowVariant, string> = {
  primary: 'from-primary/20 via-accent/10 to-primary/20',
  accent: 'from-accent/20 via-primary/10 to-accent/20',
  mixed: 'from-accent/20 via-nucleas-fourth/10 to-accent/20',
};

export default function MarketingScreenshotFrame({
  children,
  glow = 'primary',
  className,
  alt,
  nonInteractive = false,
}: MarketingScreenshotFrameProps) {
  return (
    <div className={cn('max-w-4xl mx-auto relative', className)}>
      <div
        className={cn(
          'absolute -inset-4 bg-gradient-to-r rounded-2xl blur-xl opacity-40',
          glowClasses[glow]
        )}
        aria-hidden
      />
      <div
        className={cn(
          'relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl',
          nonInteractive && 'pointer-events-none select-none'
        )}
        role={alt ? 'img' : undefined}
        aria-label={alt}
      >
        {children}
      </div>
    </div>
  );
}
