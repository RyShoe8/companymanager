const WHITESPACE_ONLY_PARAGRAPH = /<p>(?:\s|&nbsp;)*<\/p>/gi;

/** TipTap keeps one trailing empty paragraph for the cursor — strip only that one. */
const TRAILING_CURSOR_PARAGRAPH = /\s*<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>$/i;

function stripTrailingCursorParagraph(html: string): string {
  return html.replace(TRAILING_CURSOR_PARAGRAPH, '').trimEnd();
}

export function normalizeBlogBodyHtml(html: string): string {
  if (!html) return '';
  const withoutCursor = stripTrailingCursorParagraph(html.trim());
  return withoutCursor.replace(WHITESPACE_ONLY_PARAGRAPH, '<p><br></p>');
}

/** Compare editor HTML with saved HTML without spurious setContent from br/whitespace drift. */
export function canonicalizeBlogHtmlForCompare(html: string): string {
  if (!html) return '';
  const unifiedBreaks = html.replace(/<br\s*\/?>/gi, '<br>');
  return normalizeBlogBodyHtml(unifiedBreaks);
}
