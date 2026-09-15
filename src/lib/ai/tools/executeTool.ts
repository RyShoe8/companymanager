import type { GatewayConfiguration } from '@nucleas/ai-core/gateway';
import { GatewayError, generateImage } from '@nucleas/ai-core/gateway';
import { Types } from 'mongoose';
import Asset from '@/lib/models/Asset';
import { browserNavigate } from '@/lib/ai/tools/browserClient';
import { chooseBrowseTool, isBrowserWorkerConfigured } from '@/lib/ai/tools/browseRouter';
import { webFetch } from '@/lib/ai/tools/webFetch';
import { imageHitsToArtifacts } from '@/lib/ai/tools/imageSearchArtifacts';
import { imageSearch, webSearch } from '@/lib/ai/tools/webSearch';
import { listIdeTree, readIdeFile } from '@/lib/ai/ideCommitPush';

export type ToolArtifact = {
  kind: 'image';
  assetId: string;
  name: string;
  url: string;
};

export type ToolExecutionResult = {
  content: string;
  artifacts: ToolArtifact[];
};

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function executeIdeTool(input: {
  name: string;
  argumentsJson: string;
  gateway: GatewayConfiguration;
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  signal?: AbortSignal;
}): Promise<ToolExecutionResult> {
  const args = parseArgs(input.argumentsJson);
  const artifacts: ToolArtifact[] = [];

  if (input.name === 'repo_tree') {
    const path = typeof args.path === 'string' ? args.path : '';
    const result = await listIdeTree(input.organizationId, input.projectId, path);
    return { content: JSON.stringify(result).slice(0, 12000), artifacts };
  }

  if (input.name === 'repo_read') {
    const path = typeof args.path === 'string' ? args.path : '';
    if (!path.trim()) throw new Error('repo_read requires a path.');
    const result = await readIdeFile(input.organizationId, input.projectId, path);
    if (!result.ok) {
      return { content: JSON.stringify(result).slice(0, 4000), artifacts };
    }
    return {
      content: JSON.stringify({
        ok: true,
        path: result.path,
        branch: result.branch,
        sha: result.sha,
        content: result.content.slice(0, 100000),
        truncated: result.content.length > 100000,
      }).slice(0, 12000),
      artifacts,
    };
  }

  if (input.name === 'web_search') {
    const query = typeof args.query === 'string' ? args.query : '';
    const depthRaw = typeof args.depth === 'string' ? args.depth.trim() : 'standard';
    const depth =
      depthRaw === 'lite' ? 'lite' : depthRaw === 'deep' ? 'deep' : 'standard';
    const result = await webSearch(query, {
      signal: input.signal,
      depth,
      organizationId: input.organizationId,
    });
    const fromPages = imageHitsToArtifacts(result.pageImages ?? []);
    return {
      content: JSON.stringify(result).slice(0, 12000),
      artifacts: fromPages,
    };
  }

  if (input.name === 'image_search') {
    const query = typeof args.query === 'string' ? args.query : '';
    const result = await imageSearch(query, {
      signal: input.signal,
      organizationId: input.organizationId,
    });
    return {
      content: JSON.stringify(result).slice(0, 12000),
      artifacts: imageHitsToArtifacts(result.hits),
    };
  }

  if (input.name === 'web_fetch') {
    const url = typeof args.url === 'string' ? args.url : '';
    const result = await webFetch(url, { signal: input.signal });
    const routing = chooseBrowseTool({
      intent: 'browse',
      url: result.url,
      priorFetchThin: result.thin,
      priorEscalateHint: result.escalateHint,
      browserWorkerAvailable: isBrowserWorkerConfigured(),
    });
    return {
      content: JSON.stringify({
        ...result,
        suggestedNextTool: routing.tool,
        suggestReason: routing.reason,
      }).slice(0, 12000),
      artifacts,
    };
  }

  if (input.name === 'browser_navigate') {
    const url = typeof args.url === 'string' ? args.url : '';
    const result = await browserNavigate(url, { signal: input.signal });
    return { content: JSON.stringify(result).slice(0, 12000), artifacts };
  }

  if (input.name === 'image_generate') {
    const prompt = typeof args.prompt === 'string' ? args.prompt : '';
    if (!prompt.trim()) throw new Error('image_generate requires a prompt.');
    try {
      const image = await generateImage(input.gateway, { prompt, signal: input.signal });
      const name = `AI image ${new Date().toISOString().slice(0, 19)}`;
      let url: string;
      if (image.b64) {
        url = `data:image/png;base64,${image.b64.slice(0, 6_000_000)}`;
      } else if (image.url) {
        url = image.url;
      } else {
        throw new Error('Image host returned no usable payload.');
      }
      const asset = await Asset.create({
        name,
        type: 'screenshot',
        url,
        description: prompt.slice(0, 500),
        tags: ['ai-generated'],
        linkedProjectId: input.projectId,
        userId: new Types.ObjectId(input.userId),
      });
      artifacts.push({
        kind: 'image',
        assetId: String(asset._id),
        name,
        url: `/api/assets/${String(asset._id)}/content`,
      });
      return {
        content: JSON.stringify({
          ok: true,
          assetId: String(asset._id),
          prompt: prompt.slice(0, 500),
          note: 'Image generated and stored as a project asset. Describe it; do not invent extra images.',
        }),
        artifacts,
      };
    } catch (error) {
      if (error instanceof GatewayError) {
        return {
          content: JSON.stringify({
            ok: false,
            error: `Image generation failed (${error.code}). This host may not support /images/generations.`,
          }),
          artifacts,
        };
      }
      throw error;
    }
  }

  return {
    content: JSON.stringify({ error: `Unknown tool: ${input.name}` }),
    artifacts,
  };
}
