import { describe, expect, it } from 'vitest';
import { assertSafePublicHttpsUrl, isSafePublicHttpsUrl, normalizeSafeHost } from './ssrf';

describe('assertSafePublicHttpsUrl / isSafePublicHttpsUrl', () => {
  it('allows safe public HTTPS URLs', () => {
    expect(isSafePublicHttpsUrl('https://example.com/docs')).toBe(true);
    expect(assertSafePublicHttpsUrl('https://api.github.com/repos').hostname).toBe('api.github.com');
    expect(assertSafePublicHttpsUrl('https://sub.domain.co.uk/test?q=1').hostname).toBe('sub.domain.co.uk');
  });

  it('rejects non-HTTPS and credentialed URLs', () => {
    expect(isSafePublicHttpsUrl('http://example.com')).toBe(false);
    expect(isSafePublicHttpsUrl('ftp://example.com')).toBe(false);
    expect(isSafePublicHttpsUrl('https://user:pass@example.com/')).toBe(false);
  });

  it('rejects trailing dot localhost bypass attempts', () => {
    expect(isSafePublicHttpsUrl('https://localhost./')).toBe(false);
    expect(isSafePublicHttpsUrl('https://localhost../')).toBe(false);
    expect(() => assertSafePublicHttpsUrl('https://localhost.')).toThrow(/host is not allowed/i);
    expect(normalizeSafeHost('localhost.')).toBe('localhost');
  });

  it('rejects loopback and private IPv4', () => {
    expect(isSafePublicHttpsUrl('https://127.0.0.1/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://127.0.0.2:8080/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://10.1.2.3/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://172.16.0.1/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://172.31.255.255/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://192.168.1.1/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isSafePublicHttpsUrl('https://100.64.0.1/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://0.0.0.0/')).toBe(false);
  });

  it('rejects IPv4-mapped loopback in hex and decimal IPv6 notation', () => {
    // ::ffff:127.0.0.1
    expect(isSafePublicHttpsUrl('https://[::ffff:127.0.0.1]/')).toBe(false);
    // ::ffff:7f00:1 (7f00 = 127.0, 1 = 0.1)
    expect(isSafePublicHttpsUrl('https://[::ffff:7f00:1]/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://[::ffff:7f00:0001]/')).toBe(false);
    // ::ffff:10.0.0.1 or ::ffff:0a00:0001
    expect(isSafePublicHttpsUrl('https://[::ffff:0a00:1]/')).toBe(false);
    // ::ffff:192.168.1.1 or ::ffff:c0a8:0101
    expect(isSafePublicHttpsUrl('https://[::ffff:c0a8:101]/')).toBe(false);
  });

  it('rejects private IPv6 addresses', () => {
    expect(isSafePublicHttpsUrl('https://[::1]/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://[::]/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://[fc00::1]/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://[fd12:3456:789a::1]/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://[fe80::1]/')).toBe(false);
  });

  it('rejects internal and blocked domain names', () => {
    expect(isSafePublicHttpsUrl('https://metadata.google.internal/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://kubernetes.default.svc/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://myhost.local/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://myhost.internal/')).toBe(false);
    expect(isSafePublicHttpsUrl('https://myhost.localhost/')).toBe(false);
  });
});
