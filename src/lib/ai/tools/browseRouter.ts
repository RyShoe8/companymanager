/** Cost-aware browse routing: prefer search/fetch; escalate to Playwright only when needed. */

export type BrowseChoice = 'web_search' | 'web_fetch' | 'browser_navigate';

export function chooseBrowseTool(input: {
  intent: 'search' | 'fetch' | 'browse' | 'auto';
  url?: string | null;
  priorFetchThin?: boolean;
  priorEscalateHint?: boolean;
  browserWorkerAvailable: boolean;
}): { tool: BrowseChoice; reason: string } {
  if (input.intent === 'search' || (!input.url && input.intent === 'auto')) {
    return { tool: 'web_search', reason: 'Open-ended discovery uses cheap search first.' };
  }
  if (input.intent === 'fetch' || (input.url && input.intent === 'auto' && !input.priorEscalateHint)) {
    return { tool: 'web_fetch', reason: 'Concrete URLs use cheap HTTPS fetch first.' };
  }
  if (
    input.browserWorkerAvailable &&
    (input.intent === 'browse' || input.priorFetchThin || input.priorEscalateHint)
  ) {
    return {
      tool: 'browser_navigate',
      reason: 'Escalate to Playwright after thin/SPA fetch or explicit browse intent.',
    };
  }
  if (input.url) {
    return {
      tool: 'web_fetch',
      reason: 'Browser worker unavailable; staying on cheap fetch.',
    };
  }
  return { tool: 'web_search', reason: 'Fallback to search.' };
}

export function isBrowserWorkerConfigured(): boolean {
  const url = process.env.NUCLEAS_BROWSER_WORKER_URL?.trim() ?? '';
  const secret = process.env.NUCLEAS_BROWSER_WORKER_SECRET?.trim() ?? '';
  return Boolean(url.startsWith('https://') && secret.length >= 16);
}
