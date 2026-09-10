export const probeFailureMessages = {
  timeout: 'The request exceeded its time limit. This does not establish whether the remote model started.',
  dns: 'The server could not resolve the endpoint hostname.',
  tls: 'A TLS or certificate error prevented a secure connection.',
  connection_refused: 'The remote connection was refused.',
  connection_reset: 'The connection closed or reset before the request completed.',
  network_unreachable: 'The endpoint network or host was unreachable.',
  aborted: 'The request was aborted before completion.',
  invalid_response: 'The received response could not be parsed as expected.',
  unknown: 'The runtime did not provide a recognized error category. No conclusion about remote execution can be drawn.',
} as const;
export type ProbeFailureCategory = keyof typeof probeFailureMessages;

const codes: Record<string, ProbeFailureCategory> = {
  ETIMEDOUT: 'timeout', UND_ERR_CONNECT_TIMEOUT: 'timeout', UND_ERR_HEADERS_TIMEOUT: 'timeout', UND_ERR_BODY_TIMEOUT: 'timeout',
  ENOTFOUND: 'dns', EAI_AGAIN: 'dns',
  CERT_HAS_EXPIRED: 'tls', CERT_NOT_YET_VALID: 'tls', DEPTH_ZERO_SELF_SIGNED_CERT: 'tls', SELF_SIGNED_CERT_IN_CHAIN: 'tls',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'tls', UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'tls', ERR_TLS_CERT_ALTNAME_INVALID: 'tls',
  ERR_SSL_WRONG_VERSION_NUMBER: 'tls', ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION: 'tls',
  ECONNREFUSED: 'connection_refused', ECONNRESET: 'connection_reset', EPIPE: 'connection_reset', UND_ERR_SOCKET: 'connection_reset',
  ENETUNREACH: 'network_unreachable', EHOSTUNREACH: 'network_unreachable',
};
/** Allowlist only: never persist messages, stacks, hostnames, or arbitrary error codes. */
export function classifyProbeFailure(error: unknown, timedOut = false): ProbeFailureCategory {
  if (timedOut) return 'timeout';
  let current = error;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 5 && current && typeof current === 'object' && !seen.has(current); depth++) {
    seen.add(current);
    const value = current as { name?: unknown; code?: unknown; cause?: unknown };
    if (value.name === 'TimeoutError') return 'timeout';
    if (value.name === 'AbortError') return 'aborted';
    if (typeof value.code === 'string' && Object.hasOwn(codes, value.code)) return codes[value.code];
    current = value.cause;
  }
  return 'unknown';
}
