import { describe, expect, it } from 'vitest';
import { imageHitsToArtifacts, mergeImageArtifacts } from '@/lib/ai/tools/imageSearchArtifacts';

describe('imageHitsToArtifacts', () => {
  it('maps https image hits to chat artifacts', () => {
    const artifacts = imageHitsToArtifacts([
      {
        title: 'ReVamped',
        imageUrl: 'https://cdn.example.com/a.png',
      },
      {
        title: 'skip',
        imageUrl: 'http://insecure.example.com/b.png',
      },
      {
        title: 'dup',
        imageUrl: 'https://cdn.example.com/a.png',
      },
    ]);
    expect(artifacts).toEqual([
      expect.objectContaining({
        kind: 'image',
        name: 'ReVamped',
        url: 'https://cdn.example.com/a.png',
        assetId: expect.stringMatching(/^imgsearch:/),
      }),
    ]);
  });
});

describe('mergeImageArtifacts', () => {
  it('dedupes by url and caps at six', () => {
    const a = imageHitsToArtifacts([
      { title: '1', imageUrl: 'https://cdn.example.com/1.png' },
      { title: '2', imageUrl: 'https://cdn.example.com/2.png' },
    ]);
    const b = imageHitsToArtifacts([
      { title: '2b', imageUrl: 'https://cdn.example.com/2.png' },
      { title: '3', imageUrl: 'https://cdn.example.com/3.png' },
    ]);
    expect(mergeImageArtifacts(a, b).map((item) => item.url)).toEqual([
      'https://cdn.example.com/1.png',
      'https://cdn.example.com/2.png',
      'https://cdn.example.com/3.png',
    ]);
  });
});
