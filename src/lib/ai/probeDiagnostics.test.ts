import { describe, expect, it } from 'vitest';
import { classifyProbeFailure } from './probeDiagnostics';
describe('safe probe error categories', () => {
  it.each([
    ['ENOTFOUND', 'dns'], ['EAI_AGAIN', 'dns'], ['ECONNREFUSED', 'connection_refused'],
    ['ECONNRESET', 'connection_reset'], ['UND_ERR_SOCKET', 'connection_reset'],
    ['UND_ERR_CONNECT_TIMEOUT', 'timeout'], ['CERT_HAS_EXPIRED', 'tls'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'tls'], ['ENETUNREACH', 'network_unreachable'],
  ])('classifies nested %s without returning raw details', (code, expected) => {
    expect(classifyProbeFailure(new Error('private token', { cause: { code, message: 'private hostname' } }))).toBe(expected);
  });
  it('distinguishes deadline expiration, aborts and unknown errors', () => {
    expect(classifyProbeFailure(new Error('private'), true)).toBe('timeout');
    expect(classifyProbeFailure({ name: 'TimeoutError' })).toBe('timeout');
    expect(classifyProbeFailure({ name: 'AbortError' })).toBe('aborted');
    expect(classifyProbeFailure({ code: 'private-token' })).toBe('unknown');
    expect(classifyProbeFailure({ code: 'constructor' })).toBe('unknown');
    expect(classifyProbeFailure(null)).toBe('unknown');
  });
  it('bounds cyclic cause chains', () => {
    const error: { cause?: unknown } = {}; error.cause = error;
    expect(classifyProbeFailure(error)).toBe('unknown');
  });
});
