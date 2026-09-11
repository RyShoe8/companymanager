import type { AiEmployeeKey } from './teamWorkspace';

const terms: Record<AiEmployeeKey, readonly string[]> = {
  marketing: ['campaign', 'seo', 'newsletter', 'positioning', 'social media', 'ad copy'],
  product: ['roadmap', 'requirements', 'acceptance criteria', 'prioritize', 'product spec'],
  support: ['support ticket', 'customer complaint', 'refund', 'help center', 'troubleshoot'],
  engineering: ['code', 'pull request', 'database', 'api', 'unit test', 'refactor'],
};

/** Local, conservative suggestion only. Ambiguous briefs require a human choice. */
export function suggestTeamEmployee(text: string): { employee: AiEmployeeKey; matches: string[] } | null {
  const brief = text.slice(0, 6000).toLowerCase();
  const scored = (Object.entries(terms) as [AiEmployeeKey, readonly string[]][]).map(([employee, words]) => ({
    employee, matches: words.filter(word => new RegExp(`\\b${word}\\b`, 'i').test(brief)),
  })).sort((a, b) => b.matches.length - a.matches.length);
  return scored[0].matches.length > scored[1].matches.length ? scored[0] : null;
}
