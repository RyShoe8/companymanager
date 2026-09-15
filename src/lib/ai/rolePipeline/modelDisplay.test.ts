import { describe, expect, it } from 'vitest';
import { shortModelDisplayName } from '@/lib/ai/rolePipeline/providerCatalog';
import { localModelPowerScore, markFlagshipAmongModels } from '@/lib/ai/rolePipeline/modelMeta';
import { mapOpenAiModelsResponse } from '@/lib/ai/rolePipeline/discoverModels';

describe('shortModelDisplayName', () => {
  it('shortens HuggingFace-style Qwen ids to family + version', () => {
    expect(shortModelDisplayName('Qwen/Qwen2.5-Coder-14B-Instruct-AWQ')).toBe('Qwen 2.5');
    expect(shortModelDisplayName('Qwen/Qwen3-VL-8B')).toBe('Qwen 3');
  });

  it('shortens GPT catalog labels and slugs', () => {
    expect(shortModelDisplayName('GPT-5.6 Sol')).toBe('GPT 5.6');
    expect(shortModelDisplayName('gpt-5.6-sol')).toBe('GPT 5.6');
    expect(shortModelDisplayName('GPT-6 Astra')).toBe('Astra 6');
  });

  it('shortens o-series ids', () => {
    expect(shortModelDisplayName('o4-mini')).toBe('O4 mini');
  });
});

describe('localModelPowerScore generation preference', () => {
  it('prefers Qwen 3 over Qwen 2.5 Coder at similar sizes', () => {
    expect(localModelPowerScore('Qwen/Qwen3-8B')).toBeGreaterThan(
      localModelPowerScore('Qwen/Qwen2.5-Coder-14B-Instruct-AWQ')
    );
  });

  it('marks Qwen 3 as flagship when both are discovered', () => {
    const models = mapOpenAiModelsResponse({
      data: [
        { id: 'Qwen/Qwen2.5-Coder-14B-Instruct-AWQ' },
        { id: 'Qwen/Qwen3-235B-A22B' },
        { id: 'Qwen/Qwen3-8B-Instruct' },
      ],
    });
    const flagship = models.find((m) => m.flagship);
    expect(flagship?.id).toMatch(/Qwen3/i);
  });
});

describe('markFlagshipAmongModels', () => {
  it('still picks largest within same generation', () => {
    const models = markFlagshipAmongModels([
      { id: 'Qwen/Qwen3-8B', flagship: false },
      { id: 'Qwen/Qwen3-72B', flagship: false },
    ]);
    expect(models.find((m) => m.flagship)?.id).toBe('Qwen/Qwen3-72B');
  });
});
