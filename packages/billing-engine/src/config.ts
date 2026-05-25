import { setBillingContext } from './context';
import type { BillingEngineConfig } from './types';
import * as handlers from './next/handlers';

export type BillingEngine = BillingEngineConfig & {
  handlers: typeof handlers;
};

export function createBillingEngine(config: BillingEngineConfig): BillingEngine {
  setBillingContext(config);
  return {
    ...config,
    handlers,
  };
}
