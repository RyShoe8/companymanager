import type { SocialNetwork } from '@/lib/models/Project';

const HOST_RULES: { network: SocialNetwork; patterns: RegExp[] }[] = [
  { network: 'x', patterns: [/^(?:www\.)?(?:twitter|x)\.com$/i] },
  { network: 'linkedin', patterns: [/^(?:www\.)?linkedin\.com$/i] },
  { network: 'instagram', patterns: [/^(?:www\.)?instagram\.com$/i] },
  { network: 'tiktok', patterns: [/^(?:www\.)?tiktok\.com$/i] },
  { network: 'reddit', patterns: [/^(?:www\.)?reddit\.com$/i] },
  { network: 'bluesky', patterns: [/^(?:www\.)?bsky\.app$/i] },
  { network: 'youtube', patterns: [/^(?:www\.)?(?:youtube\.com|youtu\.be)$/i] },
  { network: 'facebook', patterns: [/^(?:www\.)?(?:facebook|fb)\.com$/i] },
  { network: 'github', patterns: [/^(?:www\.)?github\.com$/i] },
];

export const SOCIAL_NETWORK_LABELS: Record<SocialNetwork, string> = {
  x: 'X',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  reddit: 'Reddit',
  bluesky: 'Bluesky',
  youtube: 'YouTube',
  facebook: 'Facebook',
  github: 'GitHub',
  other: 'Link',
};

/** Normalize user input to https URL or null if invalid. */
export function normalizeSocialUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

export function detectSocialNetwork(raw: string): SocialNetwork {
  const normalized = normalizeSocialUrl(raw);
  if (!normalized) return 'other';
  try {
    const host = new URL(normalized).hostname.replace(/^www\./i, '');
    for (const rule of HOST_RULES) {
      if (rule.patterns.some((p) => p.test(host))) return rule.network;
    }
  } catch {
    // fall through
  }
  return 'other';
}

export type ProjectSocialLinkInput = {
  network: SocialNetwork;
  url: string;
  login?: string;
};

export function parseSocialLinkInput(raw: string): ProjectSocialLinkInput | null {
  const url = normalizeSocialUrl(raw);
  if (!url) return null;
  return { network: detectSocialNetwork(url), url };
}

export function sanitizeSocialLinks(raw: unknown): ProjectSocialLinkInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ProjectSocialLinkInput[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const urlRaw = typeof o.url === 'string' ? o.url : '';
    const parsed = parseSocialLinkInput(urlRaw);
    if (!parsed) continue;
    const key = `${parsed.network}::${parsed.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const login = typeof o.login === 'string' ? o.login.trim() : undefined;
    out.push({
      ...parsed,
      ...(login ? { login } : {}),
    });
  }
  return out;
}

export function validateSocialLinksUpdate(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return 'socialLinks must be an array';
  for (const item of raw) {
    if (!item || typeof item !== 'object') return 'Invalid social link entry';
    const url = (item as { url?: unknown }).url;
    if (typeof url !== 'string' || !parseSocialLinkInput(url)) return 'Invalid social URL';
  }
  return null;
}
