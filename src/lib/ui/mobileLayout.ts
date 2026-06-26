/** Shared horizontal page gutters — tighter on mobile for more content width. */
export const PAGE_GUTTER_CLASS = 'px-2 sm:px-4 md:px-6 lg:px-8';
export const PAGE_GUTTER_WIDE_CLASS = 'px-1 sm:px-4 md:px-6 lg:px-[100px]';

/** Bottom offset above the mobile nav bar (4.5rem nav + safe area). */
export const MOBILE_NAV_CLEARANCE_CLASS =
  'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]';

/** Right inset for fixed mobile FABs (safe area aware). */
export const MOBILE_FIXED_RIGHT_CLASS =
  'right-[max(0.5rem,env(safe-area-inset-right,0px))]';
