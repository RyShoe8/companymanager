import { describe, expect, it } from 'vitest';
import {
  parseCsvLine,
  parseInsightVendorCsv,
  slugFromCsvFilename,
} from './seedInsightVendorsFromCsv';

describe('parseCsvLine', () => {
  it('splits simple fields', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted commas', () => {
    expect(parseCsvLine('Vercel,https://vercel.com,"Hello, world",Free')).toEqual([
      'Vercel',
      'https://vercel.com',
      'Hello, world',
      'Free',
    ]);
  });
});

describe('parseInsightVendorCsv', () => {
  it('maps standard affiliate sheet headers', () => {
    const csv = `Company,Company URL,One-sentence description,Starter price
Vercel,https://vercel.com,Deploy apps.,Free; Pro $20/mo
Bad Row,,,
`;

    const result = parseInsightVendorCsv(csv);
    expect(result.skipped).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      name: 'Vercel',
      url: 'https://vercel.com',
      description: 'Deploy apps.',
      pricing: 'Free; Pro $20/mo',
    });
  });

  it('accepts alternate header aliases', () => {
    const csv = `Name,URL,Description,Price
Stripe,https://stripe.com,Payments platform,$0 + usage
`;
    const result = parseInsightVendorCsv(csv);
    expect(result.rows[0].name).toBe('Stripe');
    expect(result.rows[0].pricing).toBe('$0 + usage');
  });

  it('throws when required headers are missing', () => {
    expect(() => parseInsightVendorCsv('Foo,Bar\n1,2')).toThrow(/Company and URL/);
  });
});

describe('slugFromCsvFilename', () => {
  it('parses nucleas affiliate filenames', () => {
    expect(slugFromCsvFilename('Nucleas Affiliates - Hosting.csv')).toBe('hosting');
    expect(slugFromCsvFilename('Nucleas Affiliates - AI.csv')).toBe('ai');
  });

  it('parses simple slug filenames', () => {
    expect(slugFromCsvFilename('branding.csv')).toBe('branding');
  });
});
