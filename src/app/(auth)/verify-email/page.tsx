'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import RecaptchaNotice from '@/components/recaptcha/RecaptchaNotice';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { RECAPTCHA_ACTIONS } from '@/lib/recaptcha/actions';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const errorParam = searchParams.get('error');
  const verifiedParam = searchParams.get('verified');

  const [email, setEmail] = useState(emailParam);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(
    errorParam === 'invalid_or_expired'
      ? 'This verification link is invalid or has expired.'
      : errorParam === 'missing_token'
        ? 'Verification link is missing a token.'
        : errorParam === 'server'
          ? 'Something went wrong. Please try again.'
          : ''
  );
  const [sending, setSending] = useState(false);
  const { executeRecaptcha, isEnabled: recaptchaEnabled, ready: recaptchaReady } = useRecaptcha();

  if (verifiedParam === '1') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-text-primary">Email verified</h1>
          <p className="text-text-secondary">Your account is ready. Welcome to Nucleas.</p>
          <Button onClick={() => router.push('/planning-map')}>Continue</Button>
        </div>
      </div>
    );
  }

  const handleResend = async () => {
    setError('');
    setMessage('');
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setSending(true);
    try {
      const recaptchaToken = await executeRecaptcha(RECAPTCHA_ACTIONS.resendVerification);
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), recaptchaToken }),
      });
      let data: { error?: string; message?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError('Could not resend verification email.');
        return;
      }
      if (!res.ok) {
        setError(data.error || 'Could not resend verification email.');
        return;
      }
      setMessage(data.message || 'Verification email sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-text-primary">Verify your email</h1>
          <p className="text-text-secondary">
            We sent a verification link to your inbox. Click the link to activate your account, then sign in.
          </p>
        </div>

        {error && (
          <div className="bg-error-light border border-error/30 text-error px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg text-sm">
            {message}
          </div>
        )}

        <div className="space-y-3 border border-border rounded-lg p-4">
          <p className="text-sm text-text-secondary">Didn&apos;t get the email?</p>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Button
            type="button"
            onClick={() => void handleResend()}
            disabled={sending || (recaptchaEnabled && !recaptchaReady)}
            className="w-full"
          >
            {sending
              ? 'Sending…'
              : recaptchaEnabled && !recaptchaReady
                ? 'Loading security check…'
                : 'Resend verification email'}
          </Button>
          <RecaptchaNotice className="text-xs text-text-muted text-center" />
        </div>

        <p className="text-center text-sm text-text-secondary">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
