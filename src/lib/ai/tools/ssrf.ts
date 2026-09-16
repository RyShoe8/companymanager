/** SSRF fail-closed URL checks for server-side web_fetch / browser tools. */

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.arpa',
  '.onion',
  '.test',
  '.invalid',
  '.example',
];

function isPrivateIpv4(hostname: string): boolean {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const d = Number(m[4]);
  if (a > 255 || b > 255 || c > 255 || d > 255) return true; // Malformed octets treated as unsafe

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 (Loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-local)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 88 && c === 99) return true; // 192.88.99.0/24
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 (TEST-NET-3)
  if (a >= 224) return true; // 224.0.0.0/4 (Multicast & reserved 240.0.0.0/4, broadcast 255.255.255.255)
  return false;
}

function parseIpv4MappedHex(hexPart: string): string | null {
  // Format: "7f00:1" or "7f00:0001" or "c0a8:0101"
  const parts = hexPart.split(':');
  if (parts.length !== 2) return null;
  const high = parseInt(parts[0], 16);
  const low = parseInt(parts[1], 16);
  if (Number.isNaN(high) || Number.isNaN(low) || high < 0 || high > 0xffff || low < 0 || low > 0xffff) {
    return null;
  }
  const a = (high >> 8) & 0xff;
  const b = high & 0xff;
  const c = (low >> 8) & 0xff;
  const d = low & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

function isPrivateIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === '::' || h === '::1') return true;

  // Unique local: fc00::/7 (fc.. or fd..)
  if (/^f[cd][0-9a-f]{2}:/i.test(h) || h.startsWith('fc') || h.startsWith('fd')) {
    return true;
  }
  // Link-local: fe80::/10 (fe8.., fe9.., fea.., feb..)
  if (/^fe[89ab][0-9a-f]:/i.test(h) || h.startsWith('fe80:')) {
    return true;
  }
  // Multicast: ff00::/8
  if (/^ff[0-9a-f]{2}:/i.test(h) || h.startsWith('ff')) {
    return true;
  }
  // Documentation: 2001:db8::/32
  if (h.startsWith('2001:db8:') || h.startsWith('2001:0db8:')) {
    return true;
  }

  // IPv4-mapped IPv6: ::ffff:x.x.x.x or ::ffff:hex:hex or leading zeroes
  const mappedMatch = h.match(/^(?:0*:)*ffff:([0-9a-f.:]+)$/i);
  if (mappedMatch) {
    const embedded = mappedMatch[1];
    if (embedded.includes('.')) {
      return isPrivateIpv4(embedded);
    }
    const fromHex = parseIpv4MappedHex(embedded);
    if (fromHex) {
      return isPrivateIpv4(fromHex);
    }
    return true; // Treat unknown IPv4-mapped format as unsafe
  }

  return false;
}

/** Normalize hostname: lowercase, remove brackets, remove trailing dots. */
export function normalizeSafeHost(rawHost: string): string {
  return rawHost
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '');
}

/** Check if host is a safe public target. */
export function isSafePublicHost(host: string): boolean {
  const normalized = normalizeSafeHost(host);
  if (!normalized) return false;
  if (BLOCKED_HOSTS.has(normalized)) return false;
  for (const suffix of BLOCKED_SUFFIXES) {
    if (normalized.endsWith(suffix)) return false;
  }
  if (isPrivateIpv4(normalized) || isPrivateIpv6(normalized)) {
    return false;
  }
  return true;
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
  const host = normalizeSafeHost(url.hostname);
  if (!host || BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some(suffix => host.endsWith(suffix))) {
    throw new Error('That host is not allowed.');
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    throw new Error('Private network addresses are not allowed.');
  }
  return url;
}

/** Non-throwing check for safe HTTPS target. */
export function isSafePublicHttpsUrl(raw: string): boolean {
  try {
    assertSafePublicHttpsUrl(raw);
    return true;
  } catch {
    return false;
  }
}
