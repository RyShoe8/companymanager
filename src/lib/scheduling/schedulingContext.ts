import { Types } from 'mongoose';
import User from '@/lib/models/User';

export type SchedulingContext = {
  userId: Types.ObjectId;
  organizationId: string;
};

export async function getSchedulingContext(userId: string): Promise<SchedulingContext | null> {
  const user = await User.findById(userId).lean();
  if (!user?.organizationId) return null;
  return {
    userId: new Types.ObjectId(userId),
    organizationId: user.organizationId,
  };
}
