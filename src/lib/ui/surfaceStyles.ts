export type ControlSurface = 'inspector' | 'workspace';

export const WORKSPACE_TOOLBAR_BUTTON_CLASS =
  'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 px-3 py-1.5 text-sm border border-border bg-background text-text-primary hover:bg-background-accent shadow-sm';

export const WORKSPACE_ICON_PILL_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors border border-border bg-background hover:bg-background-accent';

export const WORKSPACE_PANEL_CLASS =
  'w-full basis-full space-y-3 rounded-lg border border-border bg-background p-3';

export const WORKSPACE_CATEGORY_CHIP_CLASS =
  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors border-border bg-background text-text-primary hover:bg-background-accent';

export const WORKSPACE_CATEGORY_CHIP_SELECTED_CLASS =
  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors border-primary bg-primary/10 text-primary';

export const WORKSPACE_CATALOG_ITEM_CLASS =
  'flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors border-border bg-background hover:bg-background-accent';

export const WORKSPACE_CATALOG_ITEM_DISABLED_CLASS =
  'flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors border-border bg-background-accent opacity-50 cursor-not-allowed';
