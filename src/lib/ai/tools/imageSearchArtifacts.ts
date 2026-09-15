import { createHash } from 'crypto';
import type { ToolArtifact } from '@/lib/ai/tools/executeTool';
import type { ImageSearchHit } from '@/lib/ai/tools/webSearch';

const MAX_ARTIFACTS = 6;

function artifactIdForUrl(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 20);
  return `imgsearch:${hash}`;
}

/** Map image search / page-scrape hits into chat turn artifacts for the IDE pane. */
export function imageHitsToArtifacts(
  hits: Array<Pick<ImageSearchHit, 'title' | 'imageUrl'>>,
  limit = MAX_ARTIFACTS
): ToolArtifact[] {
  const out: ToolArtifact[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const url = hit.imageUrl?.trim() ?? '';
    if (!/^https:\/\//i.test(url) || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    out.push({
      kind: 'image',
      assetId: artifactIdForUrl(url).slice(0, 64),
      name: (hit.title || 'Image').slice(0, 200),
      url: url.slice(0, 4000),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function mergeImageArtifacts(
  ...groups: ToolArtifact[][]
): ToolArtifact[] {
  const out: ToolArtifact[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      const key = item.url.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= MAX_ARTIFACTS) return out;
    }
  }
  return out;
}
