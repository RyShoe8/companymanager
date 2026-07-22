/** Compose next MultiSelect values from the latest selection (safe for rapid toggles). */
export function toggleMultiSelectValue(current: string[], optionValue: string): string[] {
  if (current.includes(optionValue)) {
    return current.filter((v) => v !== optionValue);
  }
  return [...current, optionValue];
}
