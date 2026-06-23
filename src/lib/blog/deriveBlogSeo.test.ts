import { describe, expect, it } from 'vitest';
import {
  deriveExcerpt,
  deriveMetaDescription,
  deriveMetaTitle,
  resolveBlogSeoFields,
} from '@/lib/blog/deriveBlogSeo';
import { buildBlogPostMetadata } from '@/lib/blog/buildBlogMetadata';

describe('deriveBlogSeo', () => {
  it('truncates meta title at word boundary', () => {
    const long =
      'How to Run Your Agency Operations Without Losing Your Mind Every Single Week';
    const result = deriveMetaTitle(long);
    expect(result.length).toBeLessThanOrEqual(61);
    expect(result.endsWith('…')).toBe(true);
  });

  it('strips HTML for meta description', () => {
    const result = deriveMetaDescription('<p>Hello <strong>world</strong> from Nucleas.</p>');
    expect(result).toBe('Hello world from Nucleas.');
  });

  it('derives excerpt from body when empty', () => {
    const result = deriveExcerpt('<p>First paragraph with enough text to show.</p><p>Second.</p>');
    expect(result).toContain('First paragraph');
    expect(result).not.toContain('<p>');
  });

  it('falls back title and excerpt for SEO fields', () => {
    const resolved = resolveBlogSeoFields({
      title: 'My Post Title',
      bodyHtml: '<p>Body content for the post goes here.</p>',
    });
    expect(resolved.metaTitle).toBe('My Post Title');
    expect(resolved.metaDescription).toContain('Body content');
    expect(resolved.excerpt).toContain('Body content');
  });

  it('matches buildBlogPostMetadata description', () => {
    const post = {
      slug: 'test-post',
      title: 'Test Post',
      bodyHtml: '<p>Shared description source.</p>',
    };
    const resolved = resolveBlogSeoFields(post);
    const metadata = buildBlogPostMetadata(post);
    expect(metadata.description).toBe(resolved.seoDescription);
    expect(metadata.title).toBe(resolved.seoTitle);
  });
});
