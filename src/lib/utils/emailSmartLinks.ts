/** Decode address from mailto:path (strip query). */
export function parseMailtoEmail(mailtoUrl: string): string | null {
  const trimmed = mailtoUrl.trim();
  if (!trimmed.toLowerCase().startsWith('mailto:')) return null;
  try {
    const rest = trimmed.slice('mailto:'.length);
    const path = rest.split('?')[0];
    return decodeURIComponent(path.trim()) || null;
  } catch {
    return null;
  }
}

/** Consumer Gmail / Googlemail only (not Workspace vanity domains). */
export function isConsumerGmailDomain(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const dom = email.slice(at + 1).toLowerCase().trim();
  return dom === 'gmail.com' || dom === 'googlemail.com';
}

const GMAIL_CONTINUE = 'https://mail.google.com/mail/u/0/';

/**
 * Email smart buttons store mailto: URLs. Gmail + target=_blank yields a blank tab;
 * use Google sign-in with login_hint for @gmail.com / @googlemail.com instead.
 */
export function emailSmartButtonHref(mailtoUrl: string): { href: string; openInNewTab: boolean } {
  const email = parseMailtoEmail(mailtoUrl);
  if (!email) {
    return { href: mailtoUrl, openInNewTab: false };
  }
  if (!isConsumerGmailDomain(email)) {
    return { href: mailtoUrl, openInNewTab: false };
  }
  const continueUrl = encodeURIComponent(GMAIL_CONTINUE);
  const hint = encodeURIComponent(email);
  const href = `https://accounts.google.com/signin/v2/identifier?continue=${continueUrl}&flowEntry=ServiceLogin&flowName=GlifWebSignIn&login_hint=${hint}`;
  return { href, openInNewTab: true };
}
