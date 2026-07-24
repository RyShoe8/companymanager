import { NextResponse } from 'next/server';
import type { RecaptchaAction } from '@/lib/recaptcha/actions';

const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export type VerifyRecaptchaResult =
  | { ok: true; score: number }
  | { ok: false; error: string; status: 403 | 503 };

type SiteVerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
};

export function isRecaptchaConfigured(): boolean {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY?.trim());
}

export function getRecaptchaMinScore(): number {
  const raw = process.env.RECAPTCHA_MIN_SCORE;
  if (raw == null || raw === '') return 0.5;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0.5;
}

function isProductionRecaptchaRequired(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function verifyRecaptchaToken(options: {
  token: unknown;
  expectedAction: RecaptchaAction;
}): Promise<VerifyRecaptchaResult> {
  if (!isRecaptchaConfigured()) {
    if (isProductionRecaptchaRequired()) {
      return { ok: false, error: 'Verification is unavailable. Please try again later.', status: 503 };
    }
    return { ok: true, score: 1 };
  }

  const token = typeof options.token === 'string' ? options.token.trim() : '';
  if (!token) {
    return { ok: false, error: 'Verification failed. Please try again.', status: 403 };
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY!.trim();
  const body = new URLSearchParams({ secret, response: token });

  let response: Response;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    return { ok: false, error: 'Verification failed. Please try again.', status: 403 };
  }

  let data: SiteVerifyResponse;
  try {
    data = (await response.json()) as SiteVerifyResponse;
  } catch {
    return { ok: false, error: 'Verification failed. Please try again.', status: 403 };
  }

  if (!data.success) {
    return { ok: false, error: 'Verification failed. Please try again.', status: 403 };
  }

  if (data.action !== options.expectedAction) {
    return { ok: false, error: 'Verification failed. Please try again.', status: 403 };
  }

  const score = typeof data.score === 'number' ? data.score : 0;
  if (score < getRecaptchaMinScore()) {
    return { ok: false, error: 'Verification failed. Please try again.', status: 403 };
  }

  return { ok: true, score };
}

export function recaptchaFailureResponse(result: Extract<VerifyRecaptchaResult, { ok: false }>): NextResponse {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
