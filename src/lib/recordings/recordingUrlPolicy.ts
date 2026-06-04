const privateIpv4Patterns: RegExp[] = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
];

function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.local')) return true;
  if (lower === '::1' || lower === '[::1]') return true;
  return privateIpv4Patterns.some((pattern) => pattern.test(lower));
}

function allowedHostsFromEnv(): string[] {
  const raw = process.env.RECORDING_ALLOWED_HOSTS || '';
  return raw
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function isTrustedExternalHost(hostname: string, requestOrigin?: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower.endsWith('.blob.vercel-storage.com')) return true;

  const allowed = new Set(allowedHostsFromEnv());
  if (requestOrigin) {
    try {
      allowed.add(new URL(requestOrigin).hostname.toLowerCase());
    } catch {
      // Ignore malformed origin.
    }
  }
  return allowed.has(lower);
}

export function isTrustedRecordingUrl(
  input: string,
  options?: { requestOrigin?: string; allowRelativeUploads?: boolean }
): boolean {
  const raw = input.trim();
  if (!raw) return false;

  if (options?.allowRelativeUploads && raw.startsWith('/uploads/recordings/')) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (isPrivateOrLocalHost(parsed.hostname)) return false;
  return isTrustedExternalHost(parsed.hostname, options?.requestOrigin);
}

export function assertTrustedRecordingUrl(
  input: string,
  options?: { requestOrigin?: string; allowRelativeUploads?: boolean }
): void {
  if (!isTrustedRecordingUrl(input, options)) {
    throw new Error('Recording URL host is not allowed.');
  }
}
