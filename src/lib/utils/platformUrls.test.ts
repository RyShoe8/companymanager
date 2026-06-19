import { describe, expect, it } from 'vitest';
import { getPlatformUrlList, syncPlatformUrlFields } from '@/lib/utils/platformUrls';

describe('getPlatformUrlList', () => {
  it('merges dev, live, urls, and legacy url without duplicates', () => {
    expect(
      getPlatformUrlList({
        devUrl: 'https://dev.example.com',
        liveUrl: 'https://live.example.com',
        urls: ['https://staging.example.com', 'https://dev.example.com'],
        url: 'https://legacy.example.com',
      })
    ).toEqual([
      'https://dev.example.com',
      'https://live.example.com',
      'https://staging.example.com',
      'https://legacy.example.com',
    ]);
  });
});

describe('syncPlatformUrlFields', () => {
  it('dedupes and maps first two entries to dev and live', () => {
    expect(
      syncPlatformUrlFields([
        'https://dev.example.com',
        'https://live.example.com',
        'https://dev.example.com',
        'https://docs.example.com',
      ])
    ).toEqual({
      urls: ['https://dev.example.com', 'https://live.example.com', 'https://docs.example.com'],
      devUrl: 'https://dev.example.com',
      liveUrl: 'https://live.example.com',
    });
  });

  it('clears live when only one url remains', () => {
    expect(syncPlatformUrlFields(['https://only.example.com'])).toEqual({
      urls: ['https://only.example.com'],
      devUrl: 'https://only.example.com',
      liveUrl: undefined,
    });
  });
});
