import type { SocialNetwork } from '@/lib/models/Project';
import { SOCIAL_NETWORK_LABELS } from '@/lib/utils/socialUrls';

interface SocialIconProps {
  network: SocialNetwork;
  size?: number;
  className?: string;
}

export default function SocialIcon({ network, size = 20, className = '' }: SocialIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/social/${network}.svg`}
      alt={SOCIAL_NETWORK_LABELS[network]}
      width={size}
      height={size}
      className={`inline-block shrink-0 dark:invert ${className}`}
    />
  );
}
