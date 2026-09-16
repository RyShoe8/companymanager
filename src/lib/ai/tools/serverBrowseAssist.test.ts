import { describe, expect, it } from 'vitest';
import {
  extractChatHeuristicText,
  formatImageSearchContext,
  formatWebSearchContext,
  looksLikeAnaphoricLookup,
  looksLikeImageSearchQuery,
  looksLikeProjectInternalQuery,
  looksLikeWebLookupQuery,
  resolveAssistSearchQuery,
  userTextWithBrowseContext,
  userTextWithRepoContext,
  wantsLookupScreenshots,
} from '@/lib/ai/tools/serverBrowseAssist';

describe('looksLikeWebLookupQuery', () => {
  it('matches factual ranking and research-style questions', () => {
    expect(looksLikeWebLookupQuery('who are the top 5 scorers for Arsenal all time?')).toBe(true);
    expect(looksLikeWebLookupQuery('What is the current standings in the Premier League?')).toBe(true);
    expect(looksLikeWebLookupQuery('tell me about the history of Arsenal Football Club')).toBe(true);
  });

  it('matches open-ended info digs including screenshots wording', () => {
    expect(
      looksLikeWebLookupQuery(
        'find me as much information as possible about the game Castlevania Revamped, including screenshots'
      )
    ).toBe(true);
    expect(looksLikeWebLookupQuery('see if you can find it')).toBe(true);
    expect(looksLikeWebLookupQuery("it's a fan remake, and it does exist. see if you can find it")).toBe(
      true
    );
  });

  it('rejects short, code-heavy, project-internal, or image prompts', () => {
    expect(looksLikeWebLookupQuery('hi')).toBe(false);
    expect(looksLikeWebLookupQuery('fix this TypeScript compile error please')).toBe(false);
    expect(looksLikeWebLookupQuery('find images of Emirates Stadium')).toBe(false);
    expect(looksLikeWebLookupQuery('how does our rules system work exactly?')).toBe(false);
    expect(looksLikeWebLookupQuery('Explain the codebase architecture')).toBe(false);
  });
});

describe('resolveAssistSearchQuery', () => {
  it('keeps non-anaphoric asks as-is', () => {
    const q = 'find me as much information as possible about Castlevania Revamped';
    expect(resolveAssistSearchQuery(q, ['earlier'])).toBe(q);
  });

  it('merges prior user turns for anaphoric follow-ups', () => {
    expect(looksLikeAnaphoricLookup('see if you can find it')).toBe(true);
    const resolved = resolveAssistSearchQuery("it's a fan remake, and it does exist. see if you can find it", [
      'find me as much information as possible about the game Castlevania Revamped, including screenshots',
    ]);
    expect(resolved).toMatch(/Castlevania Revamped/i);
    expect(resolved).toMatch(/fan remake/i);
  });
});

describe('wantsLookupScreenshots', () => {
  it('detects screenshot / image asks on web digs', () => {
    expect(
      wantsLookupScreenshots(
        'find me as much information as possible about the game Castlevania Revamped, including screenshots'
      )
    ).toBe(true);
    expect(wantsLookupScreenshots('who scored most for Arsenal?')).toBe(false);
  });
});

describe('looksLikeProjectInternalQuery', () => {
  it('matches rules/codebase phrasing', () => {
    expect(looksLikeProjectInternalQuery('how does our rules system work exactly?')).toBe(true);
    expect(looksLikeProjectInternalQuery('what does our rules system do and how exactly does it work?')).toBe(
      true
    );
    expect(looksLikeProjectInternalQuery('what does our rules system actually do and how does it work?')).toBe(
      true
    );
    expect(looksLikeProjectInternalQuery('Explain the codebase architecture')).toBe(true);
    expect(looksLikeProjectInternalQuery('how do we handle context in our IDE?')).toBe(true);
  });

  it('matches orchestra-wrapped Worker text even when the briefing exceeds 500 chars', () => {
    const briefing = 'x'.repeat(600);
    const wrapped = [
      'User request:',
      'what does our rules system actually do and how does it work?',
      '',
      'Planner briefing / jobs:',
      briefing,
    ].join('\n');
    expect(wrapped.length).toBeGreaterThan(500);
    expect(extractChatHeuristicText(wrapped)).toMatch(/rules system actually/);
    expect(looksLikeProjectInternalQuery(wrapped)).toBe(true);
    expect(looksLikeWebLookupQuery(wrapped)).toBe(false);
  });

  it('rejects unrelated factual asks', () => {
    expect(looksLikeProjectInternalQuery('who scored most for Arsenal?')).toBe(false);
  });
});

describe('looksLikeImageSearchQuery', () => {
  it('matches find/show image phrasing', () => {
    expect(looksLikeImageSearchQuery('find images of Emirates Stadium')).toBe(true);
    expect(looksLikeImageSearchQuery('show me photos of the Eiffel Tower')).toBe(true);
    expect(looksLikeImageSearchQuery('pictures of red foxes')).toBe(true);
    expect(looksLikeImageSearchQuery('find me a picture of mikel arteta')).toBe(true);
  });

  it('rejects AI generate requests', () => {
    expect(looksLikeImageSearchQuery('generate an image of a red fox')).toBe(false);
    expect(looksLikeImageSearchQuery('draw a picture of a stadium')).toBe(false);
  });
});

describe('formatWebSearchContext', () => {
  it('formats hits and extracts for the model', () => {
    const block = formatWebSearchContext({
      query: 'Arsenal scorers',
      note: 'Sparse.',
      hits: [
        {
          title: 'Henry',
          url: 'https://example.com/h',
          snippet: '226 goals',
          provider: 'wikipedia',
          extract: 'Thierry Henry is the record scorer.',
        },
      ],
      providersTried: ['duckduckgo_ia', 'wikipedia'],
      fetchCount: 1,
    });
    expect(block).toContain('Web search results');
    expect(block).toContain('Henry');
    expect(block).toContain('https://example.com/h');
    expect(block).toContain('Extract:');
    expect(block).toContain('Pages fetched: 1');
  });
});

describe('formatImageSearchContext', () => {
  it('formats image URLs for the model', () => {
    const block = formatImageSearchContext({
      query: 'Emirates Stadium',
      note: 'Found 1.',
      providersTried: ['google_cse'],
      toolsUsed: ['image_search'],
      hitCount: 1,
      hits: [
        {
          title: 'Emirates',
          imageUrl: 'https://cdn.example.com/e.jpg',
          contextUrl: 'https://example.com/page',
          snippet: 'Aerial',
          provider: 'google_cse',
        },
      ],
    });
    expect(block).toContain('Image search results');
    expect(block).toContain('https://cdn.example.com/e.jpg');
    expect(block).toContain('https://example.com/page');
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

  it('caps browse context at 12k', () => {
    const dig = 'X'.repeat(20_000);
    expect(userTextWithBrowseContext('q', dig).length).toBeLessThanOrEqual(12_000);
  });
});

describe('userTextWithRepoContext', () => {
  it('keeps file bodies past the browse 12k cap', () => {
    const dig = `File src/lib/ide/loadTaskRules.ts:\n${'code'.repeat(4000)}`;
    const packed = userTextWithRepoContext('how do rules work?', dig, { maxChars: 48_000 });
    expect(packed.length).toBeGreaterThan(12_000);
    expect(packed).toContain('loadTaskRules');
    expect(packed).toContain('codecode');
  });
});
