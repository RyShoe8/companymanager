export const NUCLEAS_SELECTED_PLAN_STORAGE_KEY = 'nucleas_selected_plan_id';

export function persistSelectedPlanId(planId: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = planId.trim();
  if (!trimmed) return;
  sessionStorage.setItem(NUCLEAS_SELECTED_PLAN_STORAGE_KEY, trimmed);
}

export function consumeSelectedPlanId(): string | null {
  if (typeof window === 'undefined') return null;
  const value = sessionStorage.getItem(NUCLEAS_SELECTED_PLAN_STORAGE_KEY);
  if (value) {
    sessionStorage.removeItem(NUCLEAS_SELECTED_PLAN_STORAGE_KEY);
  }
  return value;
}

export function peekSelectedPlanId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(NUCLEAS_SELECTED_PLAN_STORAGE_KEY);
}
