const NUCLEAS_SELECTED_PLAN_STORAGE_KEY = 'nucleas_selected_plan_id';
const NUCLEAS_SELECTED_INTERVAL_STORAGE_KEY = 'nucleas_selected_billing_interval';

export type StoredBillingInterval = 'month' | 'year';

export function persistSelectedPlanId(
  planId: string,
  billingInterval: StoredBillingInterval = 'month'
): void {
  if (typeof window === 'undefined') return;
  const trimmed = planId.trim();
  if (!trimmed) return;
  sessionStorage.setItem(NUCLEAS_SELECTED_PLAN_STORAGE_KEY, trimmed);
  sessionStorage.setItem(NUCLEAS_SELECTED_INTERVAL_STORAGE_KEY, billingInterval);
}

export function consumeSelectedPlanId(): string | null {
  if (typeof window === 'undefined') return null;
  const value = sessionStorage.getItem(NUCLEAS_SELECTED_PLAN_STORAGE_KEY);
  if (value) {
    sessionStorage.removeItem(NUCLEAS_SELECTED_PLAN_STORAGE_KEY);
  }
  return value;
}

export function consumeSelectedBillingInterval(): StoredBillingInterval {
  if (typeof window === 'undefined') return 'month';
  const value = sessionStorage.getItem(NUCLEAS_SELECTED_INTERVAL_STORAGE_KEY);
  sessionStorage.removeItem(NUCLEAS_SELECTED_INTERVAL_STORAGE_KEY);
  return value === 'year' ? 'year' : 'month';
}

export function peekSelectedPlanId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(NUCLEAS_SELECTED_PLAN_STORAGE_KEY);
}
