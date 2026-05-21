import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';

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
