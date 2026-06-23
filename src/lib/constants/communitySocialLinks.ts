export interface CommunitySocialLink {
  href: string;
  label: string;
  color: string;
}

export const COMMUNITY_SOCIAL_LINKS: readonly CommunitySocialLink[] = [
  {
    href: 'https://discord.gg/pT9TxHWXec',
    label: 'Discord',
    color: '#5865F2',
  },
  {
    href: 'https://bsky.app/profile/themediashop.bsky.social',
    label: 'Bluesky',
    color: '#1185fe',
  },
  {
    href: 'https://www.reddit.com/r/TheMediaShop/',
    label: 'Reddit',
    color: '#ff4500',
  },
] as const;
