import { describe, expect, it } from 'vitest';
import {
  formatWebSearchContext,
  looksLikeWebLookupQuery,
  userTextWithBrowseContext,
} from '@/lib/ai/tools/serverBrowseAssist';

describe('looksLikeWebLookupQuery', () => {
  it('matches factual ranking questions', () => {
    expect(looksLikeWebLookupQuery('who are the top 5 scorers for Arsenal all time?')).toBe(true);
    expect(looksLikeWebLookupQuery('What is the current standings in the Premier League?')).toBe(true);
  });

  it('rejects short or code-heavy prompts', () => {
    expect(looksLikeWebLookupQuery('hi')).toBe(false);
    expect(looksLikeWebLookupQuery('fix this TypeScript compile error please')).toBe(false);
  });
});

describe('formatWebSearchContext', () => {
  it('formats hits for the model', () => {
    const block = formatWebSearchContext({
      query: 'Arsenal scorers',
      note: 'Sparse.',
      hits: [{ title: 'Henry', url: 'https://example.com/h', snippet: '226 goals' }],
    });
    expect(block).toContain('Web search results');
    expect(block).toContain('Henry');
    expect(block).toContain('https://example.com/h');
  });
});

describe('userTextWithBrowseContext', () => {
  it('appends search block under the question', () => {
    expect(userTextWithBrowseContext('Who scored most?', 'Web search results:\n1. A')).toContain(
      'Who scored most?'
    );
    expect(userTextWithBrowseContext('Who scored most?', 'Web search results:\n1. A')).toContain(
      'Web search results'
    );
  });
});
