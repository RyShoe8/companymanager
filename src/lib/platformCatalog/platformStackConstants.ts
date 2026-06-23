export const PROTECTED_PLATFORM_STACK_SLUGS = ['tech', 'marketing', 'socials'] as const;

export type ProtectedPlatformStackSlug = (typeof PROTECTED_PLATFORM_STACK_SLUGS)[number];

export function isProtectedPlatformStackSlug(slug: string): boolean {
  return (PROTECTED_PLATFORM_STACK_SLUGS as readonly string[]).includes(slug);
}

export function isBuiltinCatalogStackSlug(slug: string): boolean {
  return slug === 'tech' || slug === 'marketing';
}
