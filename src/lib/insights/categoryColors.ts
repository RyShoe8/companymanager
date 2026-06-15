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

const CATEGORY_BADGE_CLASSES: Record<InsightCategoryColorKey, string> = {
  legal: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  branding: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  design: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  hosting: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  coding: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  payments: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  analytics: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  seo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  content: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  email: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  security: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  monitoring: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  support: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  automation: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  data: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  testing: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  ai: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

export function getCategoryBadgeClass(slug: string): string {
  const key = slug as InsightCategoryColorKey;
  return CATEGORY_BADGE_CLASSES[key] ?? CATEGORY_BADGE_CLASSES.support;
}
