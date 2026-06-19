/** Sync textarea height to content (min one line). */
export function adjustTextareaHeight(el: HTMLTextAreaElement, minRows = 1): void {
  el.style.height = 'auto';
  const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 20;
  const paddingTop = parseInt(getComputedStyle(el).paddingTop, 10) || 0;
  const paddingBottom = parseInt(getComputedStyle(el).paddingBottom, 10) || 0;
  const minHeight = lineHeight * minRows + paddingTop + paddingBottom;
  el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
}
