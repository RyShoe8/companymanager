'use client';

import { formatContextTokens } from '@/lib/ai/rolePipeline/providerCatalog';

export type ModelMetaStripData = {
  bestAt?: string;
  strengths?: string[];
  contextTokens?: number | null;
  pricing?: { label: string };
};

export function ModelMetaStrip({ meta }: { meta: ModelMetaStripData | null | undefined }) {
  if (!meta) {
    return <p className="mt-1 text-xs text-text-secondary">Select a model to see strengths, context, and pricing.</p>;
  }
  const strengths = meta.strengths?.length ? meta.strengths.join(', ') : null;
  return (
    <div className="mt-1 space-y-0.5 text-xs text-text-secondary">
      {meta.bestAt ? <p>Best at: <span className="text-text-primary">{meta.bestAt}</span></p> : null}
      {strengths ? <p>Strengths: <span className="text-text-primary">{strengths}</span></p> : null}
      <p>
        Context: <span className="text-text-primary">{formatContextTokens(meta.contextTokens)}</span>
        {' · '}
        Price: <span className="text-text-primary">{meta.pricing?.label ?? '—'}</span>
      </p>
    </div>
  );
}
