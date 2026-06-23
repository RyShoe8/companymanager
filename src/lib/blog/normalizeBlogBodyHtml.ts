/** Empty paragraphs from TipTap serialize with no visible height unless they contain a break. */
const EMPTY_PARAGRAPH = /<p>(?:\s|&nbsp;)*<\/p>/gi;

export function normalizeBlogBodyHtml(html: string): string {
  if (!html) return '';
  return html.replace(EMPTY_PARAGRAPH, '<p><br></p>');
}
