import { describe, expect, it } from 'vitest';
import { slugifyCatalogName } from '@/lib/platformCatalog/slugify';

describe('slugifyCatalogName', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugifyCatalogName('Content Management')).toBe('content-management');
  });

  it('strips special characters', () => {
    expect(slugifyCatalogName('Email & SMS!')).toBe('email-sms');
  });

  it('collapses repeated hyphens', () => {
    expect(slugifyCatalogName('foo   bar')).toBe('foo-bar');
  });

  it('returns empty string for blank input', () => {
    expect(slugifyCatalogName('   ')).toBe('');
  });
});
