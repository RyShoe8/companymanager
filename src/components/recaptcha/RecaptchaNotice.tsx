import Link from 'next/link';

const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();

type RecaptchaNoticeProps = {
  className?: string;
};

export default function RecaptchaNotice({ className }: RecaptchaNoticeProps) {
  if (!siteKey) return null;

  return (
    <p className={className ?? 'text-xs text-slate-500 leading-relaxed'}>
      This site is protected by reCAPTCHA and the Google{' '}
      <Link
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-slate-400 transition-colors"
      >
        Privacy Policy
      </Link>{' '}
      and{' '}
      <Link
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-slate-400 transition-colors"
      >
        Terms of Service
      </Link>{' '}
      apply.
    </p>
  );
}
