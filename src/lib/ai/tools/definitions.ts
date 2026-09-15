import type { ToolDefinition } from '@nucleas/ai-contracts';
import { isBrowserWorkerConfigured } from '@/lib/ai/tools/browseRouter';

export function ideChatToolDefinitions(options: { includeImage: boolean }): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'web_search',
        description:
          'Multi-source web search for discovery (Instant Answer, Wikipedia, optional Brave/Google/SearXNG). Prefer before browsing. Use depth=standard to also fetch top page text.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            depth: {
              type: 'string',
              description: 'lite = titles/snippets only; standard = also fetch top page extracts',
              enum: ['lite', 'standard'],
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
          'Find existing images on the public web (Google CSE). Use when the user wants photos/pictures/links of something that already exists. Prefer image_generate only when they ask to create a new AI image.',
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
          'Cheap HTTPS fetch of a public URL. Prefer this for concrete pages. Returns extracted text. Escalate only if content is thin or JS-rendered.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'HTTPS URL to fetch' },
          },
          required: ['url'],
        },
      },
    },
  ];

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
