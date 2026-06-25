export const BLOG_NAME = 'The Builders Journal';
export const BLOG_SHORT_NAME = 'Builders Journal';
export const BLOG_TAGLINE =
  'Practical ideas for running projects, teams, and your business from one place.';
export const BLOG_DESCRIPTION =
  'Insights on building and running a business from the Nucleas team.';
export const BLOG_PATH = '/blog';
export const BLOG_OG_IMAGE = '/images/marketing/builders-journal-header.png';
export const BLOG_OG_IMAGE_WIDTH = 1200;
export const BLOG_OG_IMAGE_HEIGHT = 630;
export const SITE_LOGO_URL = '/images/nucleas-logo.png';

/** Shared typography + spacing for blog body HTML (preview, public post). */
export const BLOG_BODY_PROSE_CLASS =
  'prose prose-invert max-w-none prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-primary prose-img:rounded-lg [&_p:empty]:min-h-[1.25em]';

/** TipTap editor surface — same body prose rules plus editing chrome. */
export const BLOG_EDITOR_PROSE_CLASS =
  `${BLOG_BODY_PROSE_CLASS} min-h-[280px] px-4 py-3 focus:outline-none`;

/** @deprecated Use BLOG_BODY_PROSE_CLASS */
export const BLOG_PROSE_CLASS = BLOG_BODY_PROSE_CLASS;
