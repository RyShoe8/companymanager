export type InsightCategoryColorKey =
  | 'legal'
  | 'branding'
  | 'design'
  | 'hosting'
  | 'coding'
  | 'payments'
  | 'analytics'
  | 'seo'
  | 'content'
  | 'email'
  | 'security'
  | 'monitoring'
  | 'support'
  | 'automation'
  | 'data'
  | 'testing'
  | 'ai';

const CATEGORY_BADGE_LIGHT: Record<InsightCategoryColorKey, string> = {
  legal: 'bg-orange-100 text-orange-900 border border-orange-200',
  branding: 'bg-purple-100 text-purple-900 border border-purple-200',
  design: 'bg-purple-100 text-purple-900 border border-purple-200',
  hosting: 'bg-teal-100 text-teal-900 border border-teal-200',
  coding: 'bg-teal-100 text-teal-900 border border-teal-200',
  payments: 'bg-blue-100 text-blue-900 border border-blue-200',
  analytics: 'bg-blue-100 text-blue-900 border border-blue-200',
  seo: 'bg-amber-100 text-amber-900 border border-amber-200',
  content: 'bg-amber-100 text-amber-900 border border-amber-200',
  email: 'bg-amber-100 text-amber-900 border border-amber-200',
  security: 'bg-red-100 text-red-900 border border-red-200',
  monitoring: 'bg-red-100 text-red-900 border border-red-200',
  support: 'bg-gray-100 text-gray-900 border border-gray-300',
  automation: 'bg-gray-100 text-gray-900 border border-gray-300',
  data: 'bg-gray-100 text-gray-900 border border-gray-300',
  testing: 'bg-gray-100 text-gray-900 border border-gray-300',
  ai: 'bg-purple-100 text-purple-900 border border-purple-200',
};

const CATEGORY_BADGE_DARK: Record<InsightCategoryColorKey, string> = {
  legal: 'dark:bg-orange-900/30 dark:text-orange-300',
  branding: 'dark:bg-purple-900/30 dark:text-purple-300',
  design: 'dark:bg-purple-900/30 dark:text-purple-300',
  hosting: 'dark:bg-teal-900/30 dark:text-teal-300',
  coding: 'dark:bg-teal-900/30 dark:text-teal-300',
  payments: 'dark:bg-blue-900/30 dark:text-blue-300',
  analytics: 'dark:bg-blue-900/30 dark:text-blue-300',
  seo: 'dark:bg-amber-900/30 dark:text-amber-300',
  content: 'dark:bg-amber-900/30 dark:text-amber-300',
  email: 'dark:bg-amber-900/30 dark:text-amber-300',
  security: 'dark:bg-red-900/30 dark:text-red-300',
  monitoring: 'dark:bg-red-900/30 dark:text-red-300',
  support: 'dark:bg-gray-700/50 dark:text-gray-300',
  automation: 'dark:bg-gray-700/50 dark:text-gray-300',
  data: 'dark:bg-gray-700/50 dark:text-gray-300',
  testing: 'dark:bg-gray-700/50 dark:text-gray-300',
  ai: 'dark:bg-purple-900/30 dark:text-purple-300',
};

export function getCategoryBadgeClass(slug: string, isLight = false): string {
  const key = slug as InsightCategoryColorKey;
  const lightClasses = CATEGORY_BADGE_LIGHT[key] ?? CATEGORY_BADGE_LIGHT.support;
  if (isLight) return lightClasses;
  const darkClasses = CATEGORY_BADGE_DARK[key] ?? CATEGORY_BADGE_DARK.support;
  return `${lightClasses} ${darkClasses}`;
}
