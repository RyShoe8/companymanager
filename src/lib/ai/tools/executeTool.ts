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
  allowedTools?: Set<string>;
  signal?: AbortSignal;
}): Promise<ToolExecutionResult> {
  if (input.allowedTools && !input.allowedTools.has(input.name)) {
    return {
      content: JSON.stringify({
        ok: false,
        error: `Tool "${input.name}" is not permitted for the active tool profile.`,
      }),
      artifacts: [],
    };
  }

  const args = parseArgs(input.argumentsJson);
  const artifacts: ToolArtifact[] = [];

  if (input.name === 'repo_tree') {
    const path = typeof args.path === 'string' ? args.path : '';
    const result = await listIdeTree(input.organizationId, input.projectId, path);
    if (!result.ok) {
      return { content: JSON.stringify({ ok: false, error: result.reason }), artifacts };
    }
    const entries = (result.entries ?? []).slice(0, 200).map((e) => ({
      path: e.path.slice(0, 500),
      type: e.type,
    }));
    return {
      content: JSON.stringify({
        ok: true,
        path,
        entries,
        truncated: (result.entries ?? []).length > 200,
      }),
      artifacts,
    };
  }

  if (input.name === 'repo_read') {
    const path = typeof args.path === 'string' ? args.path : '';
    if (!path.trim()) throw new Error('repo_read requires a path.');
    const result = await readIdeFile(input.organizationId, input.projectId, path);
    if (!result.ok) {
      return { content: JSON.stringify({ ok: false, error: result.reason }), artifacts };
    }
    const fullContent = result.content;
    const lines = fullContent.split('\n');
    const totalLines = lines.length;
    const totalChars = fullContent.length;

    const maxChars = Math.min(Math.max(Number(args.maxChars) || 8000, 500), 10000);
    const startLineArg =
      typeof args.startLine === 'number' && args.startLine > 0
        ? Math.floor(args.startLine)
        : undefined;
    const lineCountArg =
      typeof args.lineCount === 'number' && args.lineCount > 0
        ? Math.floor(args.lineCount)
        : undefined;
    const offsetArg =
      typeof args.offset === 'number' && args.offset >= 0
        ? Math.floor(args.offset)
        : undefined;

    let extracted: string;
    let effectiveStartLine = 1;
    let effectiveEndLine = totalLines;
    let isTruncated = false;

    if (startLineArg !== undefined) {
      effectiveStartLine = Math.min(startLineArg, totalLines);
      const count =
        lineCountArg ?? Math.max(1, Math.min(200, totalLines - effectiveStartLine + 1));
      const slicedLines = lines.slice(
        effectiveStartLine - 1,
        effectiveStartLine - 1 + count
      );
      effectiveEndLine = effectiveStartLine + slicedLines.length - 1;
      let text = slicedLines.join('\n');
      if (text.length > maxChars) {
        text = text.slice(0, maxChars);
        isTruncated = true;
      }
      extracted = text;
      isTruncated = isTruncated || effectiveEndLine < totalLines;
    } else if (offsetArg !== undefined) {
      const offset = Math.min(offsetArg, totalChars);
      extracted = fullContent.slice(offset, offset + maxChars);
      isTruncated = offset + extracted.length < totalChars;
    } else {
      if (fullContent.length > maxChars) {
        extracted = fullContent.slice(0, maxChars);
        isTruncated = true;
      } else {
        extracted = fullContent;
      }
    }

    return {
      content: JSON.stringify({
        ok: true,
        path: result.path,
        branch: result.branch,
        sha: result.sha,
        content: extracted,
        totalLines,
        totalChars,
        startLine: startLineArg,
        endLine: effectiveEndLine,
        truncated: isTruncated,
      }),
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
    const hits = (result.hits ?? []).slice(0, 10).map((hit) => ({
      title: hit.title?.slice(0, 200),
      url: hit.url?.slice(0, 500),
      snippet: hit.snippet?.slice(0, 1000),
    }));
    return {
      content: JSON.stringify({
        ok: true,
        query: result.query,
        hits,
      }),
      artifacts: fromPages,
    };
  }

  if (input.name === 'image_search') {
    const query = typeof args.query === 'string' ? args.query : '';
    const result = await imageSearch(query, {
      signal: input.signal,
      organizationId: input.organizationId,
    });
    const hits = (result.hits ?? []).slice(0, 10).map((h) => ({
      title: h.title?.slice(0, 200),
      imageUrl: h.imageUrl?.slice(0, 1000),
      contextUrl: h.contextUrl?.slice(0, 1000),
    }));
    return {
      content: JSON.stringify({
        ok: true,
        query: result.query,
        hits,
      }),
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
