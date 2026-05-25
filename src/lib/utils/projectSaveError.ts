/** Parse error message from a failed project PUT response. */
export async function projectSaveErrorMessage(
  res: Response,
  fallback = 'Failed to save project'
): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
      const err = data as { error: string; taskName?: string; taskIndex?: number };
      if (err.taskName != null && err.taskIndex != null) {
        return `${err.error} (task: "${err.taskName}")`;
      }
      return err.error;
    }
  } catch {
    // ignore
  }
  return fallback;
}
