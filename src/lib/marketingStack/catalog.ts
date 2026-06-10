import type { MarketingStackCategory } from '@/lib/models/Project';

export interface MarketingStackCatalogEntry {
  id: string;
  name: string;
  category: MarketingStackCategory;
  homepageUrl: string;
  simpleIconSlug: string;
}

export const MARKETING_STACK_CATALOG: MarketingStackCatalogEntry[] = [
  // Email
  { id: 'brevo', name: 'Brevo', category: 'email', homepageUrl: 'https://www.brevo.com', simpleIconSlug: 'brevo' },
  { id: 'mailchimp', name: 'Mailchimp', category: 'email', homepageUrl: 'https://mailchimp.com', simpleIconSlug: 'mailchimp' },
  { id: 'klaviyo', name: 'Klaviyo', category: 'email', homepageUrl: 'https://www.klaviyo.com', simpleIconSlug: 'klaviyo' },
  { id: 'convertkit', name: 'ConvertKit', category: 'email', homepageUrl: 'https://convertkit.com', simpleIconSlug: 'convertkit' },
  { id: 'activecampaign', name: 'ActiveCampaign', category: 'email', homepageUrl: 'https://www.activecampaign.com', simpleIconSlug: 'activecampaign' },
  { id: 'constantcontact', name: 'Constant Contact', category: 'email', homepageUrl: 'https://www.constantcontact.com', simpleIconSlug: 'constantcontact' },
  { id: 'sendgrid', name: 'SendGrid', category: 'email', homepageUrl: 'https://sendgrid.com', simpleIconSlug: 'sendgrid' },
  { id: 'mailerlite', name: 'MailerLite', category: 'email', homepageUrl: 'https://www.mailerlite.com', simpleIconSlug: 'mailerlite' },
  { id: 'mailjet', name: 'Mailjet', category: 'email', homepageUrl: 'https://www.mailjet.com', simpleIconSlug: 'mailjet' },
  { id: 'beehiiv', name: 'Beehiiv', category: 'email', homepageUrl: 'https://www.beehiiv.com', simpleIconSlug: 'beehiiv' },

  // Analytics
  { id: 'googleanalytics', name: 'Google Analytics', category: 'analytics', homepageUrl: 'https://analytics.google.com', simpleIconSlug: 'googleanalytics' },
  { id: 'posthog', name: 'PostHog', category: 'analytics', homepageUrl: 'https://posthog.com', simpleIconSlug: 'posthog' },
  { id: 'clarity', name: 'Microsoft Clarity', category: 'analytics', homepageUrl: 'https://clarity.microsoft.com', simpleIconSlug: 'microsoft' },
  { id: 'mixpanel', name: 'Mixpanel', category: 'analytics', homepageUrl: 'https://mixpanel.com', simpleIconSlug: 'mixpanel' },
  { id: 'amplitude', name: 'Amplitude', category: 'analytics', homepageUrl: 'https://amplitude.com', simpleIconSlug: 'amplitude' },
  { id: 'heap', name: 'Heap', category: 'analytics', homepageUrl: 'https://heap.io', simpleIconSlug: 'heap' },
  { id: 'hotjar', name: 'Hotjar', category: 'analytics', homepageUrl: 'https://www.hotjar.com', simpleIconSlug: 'hotjar' },
  { id: 'plausible', name: 'Plausible', category: 'analytics', homepageUrl: 'https://plausible.io', simpleIconSlug: 'plausibleanalytics' },
  { id: 'matomo', name: 'Matomo', category: 'analytics', homepageUrl: 'https://matomo.org', simpleIconSlug: 'matomo' },
  { id: 'segment', name: 'Segment', category: 'analytics', homepageUrl: 'https://segment.com', simpleIconSlug: 'segment' },

  // Social (management / scheduling)
  { id: 'hootsuite', name: 'Hootsuite', category: 'social', homepageUrl: 'https://www.hootsuite.com', simpleIconSlug: 'hootsuite' },
  { id: 'buffer', name: 'Buffer', category: 'social', homepageUrl: 'https://buffer.com', simpleIconSlug: 'buffer' },
  { id: 'sproutsocial', name: 'Sprout Social', category: 'social', homepageUrl: 'https://sproutsocial.com', simpleIconSlug: 'sproutsocial' },
  { id: 'later', name: 'Later', category: 'social', homepageUrl: 'https://later.com', simpleIconSlug: 'later' },
  { id: 'oneup', name: 'OneUp', category: 'social', homepageUrl: 'https://www.oneupapp.io', simpleIconSlug: 'oneup' },
  { id: 'loomly', name: 'Loomly', category: 'social', homepageUrl: 'https://www.loomly.com', simpleIconSlug: 'loomly' },
  { id: 'socialbee', name: 'SocialBee', category: 'social', homepageUrl: 'https://socialbee.com', simpleIconSlug: 'socialbee' },
  { id: 'agorapulse', name: 'Agorapulse', category: 'social', homepageUrl: 'https://www.agorapulse.com', simpleIconSlug: 'agorapulse' },
  { id: 'planable', name: 'Planable', category: 'social', homepageUrl: 'https://planable.io', simpleIconSlug: 'planable' },
  { id: 'coschedule', name: 'CoSchedule', category: 'social', homepageUrl: 'https://coschedule.com', simpleIconSlug: 'coschedule' },

  // CRM
  { id: 'salesforce', name: 'Salesforce', category: 'crm', homepageUrl: 'https://www.salesforce.com', simpleIconSlug: 'salesforce' },
  { id: 'hubspot', name: 'HubSpot', category: 'crm', homepageUrl: 'https://www.hubspot.com', simpleIconSlug: 'hubspot' },
  { id: 'pipedrive', name: 'Pipedrive', category: 'crm', homepageUrl: 'https://www.pipedrive.com', simpleIconSlug: 'pipedrive' },
  { id: 'zoho', name: 'Zoho', category: 'crm', homepageUrl: 'https://www.zoho.com/crm', simpleIconSlug: 'zoho' },
  { id: 'monday', name: 'Monday.com', category: 'crm', homepageUrl: 'https://monday.com', simpleIconSlug: 'monday' },
  { id: 'copper', name: 'Copper', category: 'crm', homepageUrl: 'https://www.copper.com', simpleIconSlug: 'copper' },
  { id: 'freshsales', name: 'Freshsales', category: 'crm', homepageUrl: 'https://www.freshworks.com/crm/sales', simpleIconSlug: 'freshworks' },
  { id: 'intercom', name: 'Intercom', category: 'crm', homepageUrl: 'https://www.intercom.com', simpleIconSlug: 'intercom' },
  { id: 'zendesk', name: 'Zendesk', category: 'crm', homepageUrl: 'https://www.zendesk.com', simpleIconSlug: 'zendesk' },
  { id: 'close', name: 'Close', category: 'crm', homepageUrl: 'https://www.close.com', simpleIconSlug: 'close' },
];

const catalogById = new Map(MARKETING_STACK_CATALOG.map((e) => [e.id, e]));

export function getMarketingCatalogEntry(toolId: string): MarketingStackCatalogEntry | undefined {
  return catalogById.get(toolId);
}

export function getMarketingCatalogByCategory(category: MarketingStackCategory): MarketingStackCatalogEntry[] {
  return MARKETING_STACK_CATALOG.filter((e) => e.category === category);
}

export const MARKETING_STACK_CATEGORIES: MarketingStackCategory[] = [
  'email',
  'analytics',
  'social',
  'crm',
];
