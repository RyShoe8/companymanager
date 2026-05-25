import type { BillingEngineConfig } from './types';

let billingContext: BillingEngineConfig | null = null;

export function setBillingContext(config: BillingEngineConfig): void {
  billingContext = config;
}

export function getBillingContext(): BillingEngineConfig {
  if (!billingContext) {
    throw new Error('billing-engine: call createBillingEngine() before using billing APIs');
  }
  return billingContext;
}

export async function connectBillingDb(): Promise<void> {
  await getBillingContext().connect();
}

export function getOrganizationModel() {
  return getBillingContext().organization.model;
}
