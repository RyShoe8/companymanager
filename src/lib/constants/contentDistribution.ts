export const DISTRIBUTION_METHODS = ['X', 'LinkedIn', 'Instagram', 'TikTok', 'Reddit', 'Bluesky', 'Email', 'Facebook', 'YouTube'] as const;

export type DistributionMethod = (typeof DISTRIBUTION_METHODS)[number];

export function isDistributionMethod(value: string): value is DistributionMethod {
  return (DISTRIBUTION_METHODS as readonly string[]).includes(value);
}

export function parseDelimitedList(text: string): string[] {
  return text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}
