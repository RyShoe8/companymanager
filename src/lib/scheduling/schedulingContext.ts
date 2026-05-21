import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import UserAvailability from '@/lib/models/UserAvailability';

const DEFAULT_SCHEDULING_TIMEZONE = 'America/New_York';

export type SchedulingContext = {
  userId: Types.ObjectId;
  organizationId: string;
};

export async function getSchedulingContext(userId: string): Promise<SchedulingContext | null> {
  await connectDB();
  const user = await User.findById(userId).lean();
  if (!user?.organizationId) return null;
  return {
    userId: new Types.ObjectId(userId),
    organizationId: user.organizationId,
  };
}

/** IANA timezone for Google Calendar and scheduling (availability doc, then default). */
export async function getUserSchedulingTimezone(
  userId: string | Types.ObjectId,
  bodyTimeZone?: string
): Promise<string> {
  const fromBody = typeof bodyTimeZone === 'string' ? bodyTimeZone.trim() : '';
  if (fromBody) return fromBody;

  await connectDB();
  const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const doc = await UserAvailability.findOne({ userId: uid }).select('timezone').lean();
  return doc?.timezone?.trim() || DEFAULT_SCHEDULING_TIMEZONE;
}
