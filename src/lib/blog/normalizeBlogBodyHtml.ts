/** Paragraph with only whitespace, nbsp, and/or br (TipTap cursor / spacer). */
const EMPTY_PARAGRAPH = /<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi;

const WHITESPACE_ONLY_PARAGRAPH = /<p>(?:\s|&nbsp;)*<\/p>/gi;

const TRAILING_EMPTY_PARAGRAPHS = /(?:\s*<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>)+$/i;

function stripTrailingEmptyParagraphs(html: string): string {
  return html.replace(TRAILING_EMPTY_PARAGRAPHS, '').trimEnd();
}

export function normalizeBlogBodyHtml(html: string): string {
  if (!html) return '';
  const withoutTrailing = stripTrailingEmptyParagraphs(html.trim());
  return withoutTrailing.replace(WHITESPACE_ONLY_PARAGRAPH, '<p><br></p>');
}

/** Compare editor HTML with saved HTML without spurious setContent from br/whitespace drift. */
export function canonicalizeBlogHtmlForCompare(html: string): string {
  if (!html) return '';
  const unifiedBreaks = html.replace(/<br\s*\/?>/gi, '<br>');
  return normalizeBlogBodyHtml(unifiedBreaks);
}
