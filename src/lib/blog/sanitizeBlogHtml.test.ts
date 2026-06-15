import { describe, expect, it } from 'vitest';
import { sanitizeBlogHtml } from '@/lib/blog/sanitizeBlogHtml';

describe('sanitizeBlogHtml', () => {
  it('strips script tags and event handlers', () => {
    const dirty =
      '<p>Hello</p><script>alert("xss")</script><img src="x" onerror="alert(1)" alt="">';
    const clean = sanitizeBlogHtml(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('<p>Hello</p>');
  });

  it('keeps allowed formatting tags', () => {
    const html =
      '<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul>';
    expect(sanitizeBlogHtml(html)).toBe(html);
  });

  it('keeps safe links and images', () => {
    const html =
      '<p><a href="https://example.com" target="_blank" rel="noopener">Link</a></p><img src="/uploads/blog/test.webp" alt="Cover">';
    const clean = sanitizeBlogHtml(html);
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('src="/uploads/blog/test.webp"');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeBlogHtml('')).toBe('');
  });
});
