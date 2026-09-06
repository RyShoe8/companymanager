import 'server-only';
import mongoose, { type ClientSession } from 'mongoose';

export async function aiTransaction<T>(work: (session: ClientSession) => Promise<T>, existing?: ClientSession): Promise<T> {
  if (existing) return work(existing);
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => work(session), { maxCommitTimeMS: 5000 }); }
  finally { await session.endSession(); }
}
