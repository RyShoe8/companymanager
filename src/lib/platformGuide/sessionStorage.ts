const STEP_KEY = 'platformGuideStepIndex';

export function readGuideStepIndex(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STEP_KEY);
    if (raw == null) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeGuideStepIndex(index: number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STEP_KEY, String(index));
  } catch {
    // ignore quota errors
  }
}

export function clearGuideStepIndex(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STEP_KEY);
  } catch {
    // ignore
  }
}
