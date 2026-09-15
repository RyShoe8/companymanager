import { assertSafePublicHttpsUrl } from '@/lib/ai/tools/ssrf';
import { isBrowserWorkerConfigured } from '@/lib/ai/tools/browseRouter';

export type BrowserNavigateResult = {
  url: string;
  title: string | null;
  text: string;
  note: string;
};

/** Call the optional Playwright browser worker. Fail closed when unset. */
export async function browserNavigate(
  rawUrl: string,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}
): Promise<BrowserNavigateResult> {
  if (!isBrowserWorkerConfigured()) {
    throw new Error(
      'Browser worker is not configured (set NUCLEAS_BROWSER_WORKER_URL and NUCLEAS_BROWSER_WORKER_SECRET). Use web_fetch instead.'
    );
  }
  const target = assertSafePublicHttpsUrl(rawUrl);
  const workerBase = process.env.NUCLEAS_BROWSER_WORKER_URL!.replace(/\/+$/, '');
  const workerUrl = assertSafePublicHttpsUrl(`${workerBase}/navigate`);
  const secret = process.env.NUCLEAS_BROWSER_WORKER_SECRET!.trim();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) throw new Error('Browser navigate cancelled.');
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 45000);
  try {
    const response = await (options.fetcher ?? fetch)(workerUrl, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ url: target.toString(), maxChars: 12000 }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Browser worker rejected the navigate request.');
    }
    const body = (await response.json()) as {
      url?: string;
      title?: string | null;
      text?: string;
    };
    return {
      url: typeof body.url === 'string' ? body.url : target.toString(),
      title: typeof body.title === 'string' ? body.title.slice(0, 200) : null,
      text: typeof body.text === 'string' ? body.text.slice(0, 12000) : '',
      note: 'Rendered via Playwright browser worker.',
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}
