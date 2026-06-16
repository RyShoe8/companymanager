import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import OnboardingBookingModel from '@/lib/models/OnboardingBooking';
import { requireOnboardingEligible } from '@/lib/onboarding/requireOnboardingEligible';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await requireOnboardingEligible();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const booking = await OnboardingBookingModel.findOne({
    _id: id,
    organizationId: gate.organizationId,
    status: 'scheduled',
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  booking.status = 'canceled';
  await booking.save();

  return NextResponse.json({ canceled: true });
}
