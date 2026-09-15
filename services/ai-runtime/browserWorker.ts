/**
 * Optional Playwright browser worker for cost-aware escalate browsing.
 *
 * Env:
 * - NUCLEAS_BROWSER_WORKER_URL (this service's public HTTPS base, set on the Next app)
 * - NUCLEAS_BROWSER_WORKER_SECRET (shared bearer)
 * - PORT (default 8791)
 *
 * Run: npx tsx services/ai-runtime/browserWorker.ts
 * Requires: playwright (and browsers installed via `npx playwright install chromium`)
 */

import http from 'http';
import { pathToFileURL } from 'url';

const PORT = Number(process.env.PORT || 8791);
const SECRET = process.env.NUCLEAS_BROWSER_WORKER_SECRET?.trim() ?? '';

function readBody(req: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isSafeHttpsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function navigate(url: string, maxChars: number) {
  // Dynamic load so the Next app typechecks without playwright installed in-tree.
  const playwright = (await import(
    /* webpackIgnore: true */ 'playwright' as string
  )) as {
    chromium: { launch: (opts: { headless: boolean }) => Promise<{
      newPage: () => Promise<{
        goto: (u: string, o: { waitUntil: string; timeout: number }) => Promise<unknown>;
        title: () => Promise<string>;
        evaluate: (fn: () => string) => Promise<string>;
        url: () => string;
      }>;
      close: () => Promise<void>;
    }> };
  };
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await page.title();
    const text = await page.evaluate(() => document.body?.innerText ?? '');
    return {
      url: page.url(),
      title: title.slice(0, 200),
      text: String(text).replace(/\s+/g, ' ').trim().slice(0, maxChars),
    };
  } finally {
    await browser.close();
  }
}

export function startBrowserWorkerServer() {
  if (SECRET.length < 16) {
    throw new Error('NUCLEAS_BROWSER_WORKER_SECRET must be at least 16 characters.');
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.method !== 'POST' || req.url !== '/navigate') {
        res.writeHead(404);
        res.end();
        return;
      }
      const auth = req.headers.authorization ?? '';
      if (auth !== `Bearer ${SECRET}`) {
        res.writeHead(401);
        res.end();
        return;
      }
      const raw = await readBody(req, 16_000);
      const body = JSON.parse(raw) as { url?: string; maxChars?: number };
      const url = typeof body.url === 'string' ? body.url : '';
      if (!isSafeHttpsUrl(url)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unsafe URL' }));
        return;
      }
      const maxChars = Math.min(Math.max(Number(body.maxChars) || 12000, 1000), 20000);
      const result = await navigate(url, maxChars);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'navigate_failed' }));
    }
  });

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`browserWorker listening on ${PORT}`);
  });
  return server;
}

const isDirectRun =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  startBrowserWorkerServer();
}
