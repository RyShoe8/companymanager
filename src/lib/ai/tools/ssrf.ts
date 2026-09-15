/** SSRF fail-closed URL checks for server-side web_fetch / browser tools. */

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

function isPrivateIpv4(hostname: string): boolean {
  const m = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === '::1' ||
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    h.startsWith('fe80') ||
    h === '::' ||
    h.startsWith('::ffff:127.') ||
    h.startsWith('::ffff:10.') ||
    h.startsWith('::ffff:192.168.')
  );
}

/** Parse and reject non-HTTPS or private/metadata targets. */
export function assertSafePublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('Invalid URL.');
  }
  if (url.protocol !== 'https:') throw new Error('Only HTTPS URLs are allowed.');
  if (url.username || url.password) throw new Error('Credentials in URLs are not allowed.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('That host is not allowed.');
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    throw new Error('Private network addresses are not allowed.');
  }
  return url;
}
