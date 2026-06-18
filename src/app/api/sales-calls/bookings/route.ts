import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSalesCallBooking } from '@/lib/onboarding/salesCallBooking';
import { enforceRateLimit, rateLimitKey } from '@/lib/security/rateLimit';
import { RECAPTCHA_ACTIONS } from '@/lib/recaptcha/actions';
import { recaptchaFailureResponse, verifyRecaptchaToken } from '@/lib/recaptcha/verifyRecaptcha';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  start: z.string().datetime(),
  attendeeName: z.string().min(1).max(120),
  attendeeEmail: z.string().email(),
  recaptchaToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const limit = enforceRateLimit({
    key: rateLimitKey(request, 'sales-call-booking'),
    limit: 5,
    windowMs: 60_000,
  });
  if (limit) return limit;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Name, email, and a valid time are required' }, { status: 400 });
  }

  const captcha = await verifyRecaptchaToken({
    token: parsed.data.recaptchaToken,
    expectedAction: RECAPTCHA_ACTIONS.bookCall,
  });
  if (!captcha.ok) return recaptchaFailureResponse(captcha);

  const { start, attendeeName, attendeeEmail } = parsed.data;
  const result = await createSalesCallBooking({ start, attendeeName, attendeeEmail });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ booking: result.booking });
}
