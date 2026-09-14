import { describe, expect, it } from 'vitest';
import {
  mapOpenAiModelsResponse,
  modelsUrlFromChatEndpoint,
} from '@/lib/ai/rolePipeline/discoverModels';
import {
  cleanedCompanyLabel,
  companyDisplayName,
} from '@/lib/ai/rolePipeline/providerCatalog';

describe('modelsUrlFromChatEndpoint', () => {
  it('maps chat completions to models', () => {
    expect(
      modelsUrlFromChatEndpoint('https://api.example.com/v1/chat/completions').href
    ).toBe('https://api.example.com/v1/models');
  });

  it('appends models under an API root', () => {
    expect(modelsUrlFromChatEndpoint('https://llm.example.com/v1').href).toBe(
      'https://llm.example.com/v1/models'
    );
  });

  it('keeps an existing models path', () => {
    expect(modelsUrlFromChatEndpoint('https://api.example.com/v1/models').href).toBe(
      'https://api.example.com/v1/models'
    );
  });

  it('rejects non-https endpoints', () => {
    expect(() => modelsUrlFromChatEndpoint('http://api.example.com/v1/chat/completions')).toThrow();
  });
});

describe('mapOpenAiModelsResponse', () => {
  it('maps and sorts OpenAI-style data ids', () => {
    expect(
      mapOpenAiModelsResponse({
        data: [{ id: 'zeta' }, { id: 'alpha' }, { id: 'alpha' }, { id: '' }, null],
      })
    ).toEqual([
      { id: 'alpha', label: 'alpha' },
      { id: 'zeta', label: 'zeta' },
    ]);
  });

  it('returns empty for invalid bodies', () => {
    expect(mapOpenAiModelsResponse(null)).toEqual([]);
    expect(mapOpenAiModelsResponse({ data: 'nope' })).toEqual([]);
  });
});

describe('companyDisplayName / cleanedCompanyLabel', () => {
  it('uses catalog company name for known providers', () => {
    expect(companyDisplayName({ label: 'OpenAI · GPT-4o mini', provider: 'openai' })).toBe('OpenAI');
    expect(cleanedCompanyLabel({ label: 'OpenAI · GPT-4o mini', provider: 'openai' })).toBe('OpenAI');
  });

  it('strips trailing model suffix for custom hosts', () => {
    expect(companyDisplayName({ label: 'Home Lab · Qwen', provider: 'custom' })).toBe('Home Lab');
    expect(cleanedCompanyLabel({ label: 'Home Lab · Qwen', provider: 'custom' })).toBe('Home Lab');
  });

  it('leaves company-only labels alone', () => {
    expect(companyDisplayName({ label: 'OpenAI', provider: 'openai' })).toBe('OpenAI');
    expect(cleanedCompanyLabel({ label: 'OpenAI', provider: 'openai' })).toBeNull();
  });
});
