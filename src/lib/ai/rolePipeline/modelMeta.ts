import { microsToDollars } from '@/lib/ai/settingsSchema';
import { lookupModelTokenRate } from '@/lib/ai/pricing/modelRates';
import {
  findCatalogModel,
  type CatalogModel,
  type ModelStrength,
} from '@/lib/ai/rolePipeline/providerCatalog';

export type ModelPricingDisplay = {
  free: boolean;
  label: string;
  inputPer1M: string | null;
  outputPer1M: string | null;
};

export type ModelMetaView = {
  id: string;
  label: string;
  bestAt: string;
  strengths: ModelStrength[];
  contextTokens: number | null;
  pricing: ModelPricingDisplay;
};

/** Whether this credential should show Free token pricing. */
export function isFreeCredential(input: { provider?: string | null; tier?: string | null }): boolean {
  const provider = input.provider ?? 'custom';
  if (provider === 'custom') return true;
  return input.tier === 'local_remote';
}

export function getModelPricingDisplay(
  modelId: string,
  opts: { free: boolean }
): ModelPricingDisplay {
  if (opts.free) {
    return { free: true, label: 'Free', inputPer1M: null, outputPer1M: null };
  }
  const rate = lookupModelTokenRate(modelId);
  if (!rate) {
    return { free: false, label: 'Pricing unknown', inputPer1M: null, outputPer1M: null };
  }
  const inputPer1M = microsToDollars(rate.inputMicrosPer1M);
  const outputPer1M = microsToDollars(rate.outputMicrosPer1M);
  return {
    free: false,
    label: `$${inputPer1M} / $${outputPer1M} per 1M`,
    inputPer1M,
    outputPer1M,
  };
}

/** Heuristic meta for self-hosted / discovered model ids. */
export function localModelMetaOverlay(modelId: string): Pick<CatalogModel, 'bestAt' | 'strengths'> {
  const id = modelId.toLowerCase();
  if (id.includes('bge') || id.includes('embed')) {
    return { bestAt: 'Embeddings and retrieval', strengths: ['embeddings'] };
  }
  if (id.includes('coder') || id.includes('code')) {
    return { bestAt: 'Local coding and code edits', strengths: ['coding', 'chat'] };
  }
  if (id.includes('-vl') || id.includes('vision') || id.includes('llava')) {
    return { bestAt: 'Vision and multimodal understanding', strengths: ['vision', 'chat'] };
  }
  if (id.includes('reason') || id.includes('thinking') || id.includes('r1')) {
    return { bestAt: 'Local reasoning', strengths: ['reasoning', 'chat'] };
  }
  if (id.includes('gemma') || id.includes('llama') || id.includes('qwen') || id.includes('mistral')) {
    return { bestAt: 'General local chat', strengths: ['chat'] };
  }
  return { bestAt: 'General local model', strengths: ['chat'] };
}

export function buildModelMetaView(input: {
  id: string;
  label?: string;
  contextTokens?: number | null;
  bestAt?: string;
  strengths?: ModelStrength[];
  free: boolean;
}): ModelMetaView {
  const catalog = findCatalogModel(input.id);
  const local = !catalog ? localModelMetaOverlay(input.id) : null;
  return {
    id: input.id,
    label: input.label ?? catalog?.label ?? input.id,
    bestAt: input.bestAt ?? catalog?.bestAt ?? local?.bestAt ?? 'General assistant',
    strengths: input.strengths ?? catalog?.strengths ?? local?.strengths ?? ['chat'],
    contextTokens: input.contextTokens ?? catalog?.contextTokens ?? null,
    pricing: getModelPricingDisplay(input.id, { free: input.free }),
  };
}

export function enrichCatalogModelsForApi(
  models: CatalogModel[],
  opts: { free: boolean }
): ModelMetaView[] {
  return models.map((model) =>
    buildModelMetaView({
      id: model.id,
      label: model.label,
      bestAt: model.bestAt,
      strengths: model.strengths,
      contextTokens: model.contextTokens,
      free: opts.free,
    })
  );
}
