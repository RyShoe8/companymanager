import type { ToolDefinition } from '@nucleas/ai-contracts';
import { isBrowserWorkerConfigured } from '@/lib/ai/tools/browseRouter';

export type IdeToolProfile = 'full' | 'repo' | 'none';

export function ideChatToolDefinitions(options: {
  includeImage: boolean;
  /** When false, omit GitHub repo tools (e.g. Free Chat). Default true for project IDE. */
  includeRepo?: boolean;
  /** Restrict which tools are offered. Plan mode uses `repo` (read-only). */
  profile?: IdeToolProfile;
}): ToolDefinition[] {
  const profile = options.profile ?? 'full';
  if (profile === 'none') return [];

  const includeRepo = options.includeRepo !== false;
  const tools: ToolDefinition[] = [];

  if (includeRepo) {
    tools.push(
      {
        type: 'function',
        function: {
          name: 'repo_tree',
          description:
            'List files and folders in the bound project GitHub repository. Use for exploring this codebase. path empty = repo root.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Directory path relative to repo root (omit or empty for root)',
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'repo_read',
          description:
            'Read a UTF-8 text file from the bound project GitHub repository with optional line/character paging. Prefer this over web_search for project-internal questions.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path relative to repo root' },
              startLine: { type: 'integer', description: 'Optional 1-based start line to read from' },
              lineCount: { type: 'integer', description: 'Optional number of lines to read' },
              offset: { type: 'integer', description: 'Optional character offset to start reading from' },
              maxChars: { type: 'integer', description: 'Optional maximum character limit to return (default 8000, max 10000)' },
            },
            required: ['path'],
          },
        },
      }
    );
  }

  if (profile === 'repo') return tools;

  tools.push(
    {
      type: 'function',
      function: {
        name: 'web_search',
        description:
          'Multi-source web search for external/public discovery. Do not use for this project’s own code or rules—use repo_tree/repo_read first.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            depth: {
              type: 'string',
              description:
                'lite = titles/snippets only; standard = fetch top page extracts (default); deep = also Playwright-render top pages when configured',
              enum: ['lite', 'standard', 'deep'],
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'image_search',
        description:
          'Find existing images on the public web. Prefer image_generate only when the user asks to create a new AI image.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Image search query' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'web_fetch',
        description:
          'Cheap HTTPS fetch of a public URL. Prefer for concrete external pages. Escalate only if content is thin or JS-rendered.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'HTTPS URL to fetch' },
          },
          required: ['url'],
        },
      },
    }
  );

  if (isBrowserWorkerConfigured()) {
    tools.push({
      type: 'function',
      function: {
        name: 'browser_navigate',
        description:
          'Costly Playwright render. Use only after web_fetch was thin/SPA or when JS rendering is required. Never for private/local hosts.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'HTTPS URL to open in the browser worker' },
          },
          required: ['url'],
        },
      },
    });
  }

  if (options.includeImage) {
    tools.push({
      type: 'function',
      function: {
        name: 'image_generate',
        description:
          'Generate an image with the current company/local image-capable model. Only call when the user asks for an image.',
        parameters: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Image generation prompt' },
          },
          required: ['prompt'],
        },
      },
    });
  }

  return tools;
}
