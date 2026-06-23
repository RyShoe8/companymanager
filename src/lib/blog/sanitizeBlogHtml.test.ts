import { describe, expect, it } from 'vitest';
import {
  canonicalizeBlogHtmlForCompare,
  normalizeBlogBodyHtml,
} from '@/lib/blog/normalizeBlogBodyHtml';
import { sanitizeBlogHtml } from '@/lib/blog/sanitizeBlogHtml';

describe('normalizeBlogBodyHtml', () => {
  it('strips trailing empty paragraphs from single Enter cursor artifacts', () => {
    expect(normalizeBlogBodyHtml('<p>Hello</p><p></p>')).toBe('<p>Hello</p>');
    expect(normalizeBlogBodyHtml('<p>Hello</p><p><br></p>')).toBe('<p>Hello</p>');
    expect(normalizeBlogBodyHtml('<p>Hello</p><p><br /></p>')).toBe('<p>Hello</p>');
  });

  it('converts internal empty paragraphs to br placeholders', () => {
    expect(normalizeBlogBodyHtml('<p>A</p><p></p><p>B</p>')).toBe(
      '<p>A</p><p><br></p><p>B</p>'
    );
    expect(normalizeBlogBodyHtml('<p>A</p><p> </p><p>&nbsp;</p><p>B</p>')).toBe(
      '<p>A</p><p><br></p><p><br></p><p>B</p>'
    );
  });

  it('leaves paragraphs with soft breaks unchanged', () => {
    const html = '<p>line1<br><br>line2</p>';
    expect(normalizeBlogBodyHtml(html)).toBe(html);
  });

  it('canonicalize treats br variants as equivalent', () => {
    const raw = '<p>line1<br><br>line2</p>';
    const saved = '<p>line1<br /><br />line2</p>';
    expect(canonicalizeBlogHtmlForCompare(raw)).toBe(canonicalizeBlogHtmlForCompare(saved));
  });
});

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

  it('strips trailing empty paragraphs on save', () => {
    expect(sanitizeBlogHtml('<p>A</p><p></p>')).toBe('<p>A</p>');
  });

  it('normalizes internal empty paragraphs after sanitization', () => {
    expect(sanitizeBlogHtml('<p>A</p><p></p><p>B</p>')).toBe(
      '<p>A</p><p><br></p><p>B</p>'
    );
  });

  it('preserves soft breaks inside paragraphs', () => {
    const html = '<p>line1<br><br>line2</p>';
    expect(sanitizeBlogHtml(html)).toBe('<p>line1<br /><br />line2</p>');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeBlogHtml('')).toBe('');
  });
});
