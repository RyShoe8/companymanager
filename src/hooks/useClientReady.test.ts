import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useClientReady } from './useClientReady';

describe('useClientReady', () => {
  it('keeps portal content out of server rendering without accessing browser globals', () => {
    function PortalGate() {
      return useClientReady() ? 'client' : 'server';
    }
    expect(renderToString(createElement(PortalGate))).toBe('server');
  });
});
