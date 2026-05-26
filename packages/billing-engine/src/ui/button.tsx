import * as React from 'react';
import { cn } from './cn';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type LegacyVariant = 'default' | 'outline' | 'ghost' | 'link';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant | LegacyVariant;
  size?: 'sm' | 'md' | 'lg' | 'default';
};

function resolveVariant(variant: ButtonVariant | LegacyVariant): ButtonVariant {
  switch (variant) {
    case 'secondary':
    case 'outline':
    case 'ghost':
      return 'secondary';
    case 'danger':
      return 'danger';
    case 'link':
      return 'secondary';
    case 'default':
    case 'primary':
    default:
      return 'primary';
  }
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const resolved = resolveVariant(variant);
    const resolvedSize = size === 'default' ? 'md' : size;

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px] sm:min-h-0',
          resolved === 'primary' &&
            'bg-primary text-white hover:bg-primary-hover focus:ring-primary',
          resolved === 'secondary' &&
            'bg-secondary-light text-secondary hover:bg-secondary-light/80 focus:ring-secondary border border-secondary/20',
          resolved === 'danger' && 'bg-error text-white hover:bg-error-dark focus:ring-error',
          resolvedSize === 'sm' && 'px-3 py-1.5 text-sm',
          resolvedSize === 'md' && 'px-4 py-2 text-base',
          resolvedSize === 'lg' && 'px-6 py-3 text-lg',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
