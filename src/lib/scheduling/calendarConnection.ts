import connectDB from '@/lib/db/mongodb';
import UserCalendarConnection from '@/lib/models/UserCalendarConnection';
import { decryptToken, encryptToken } from '@/lib/scheduling/tokenCrypto';
import { refreshAccessToken } from '@/lib/scheduling/googleCalendar';
import { Types } from 'mongoose';

export async function getGoogleAccessTokenForUser(
  userId: Types.ObjectId
): Promise<{ accessToken: string; calendarId: string } | null> {
  await connectDB();
  const conn = await UserCalendarConnection.findOne({ userId, provider: 'google' });
  if (!conn?.refreshTokenEncrypted) return null;
  const refreshToken = decryptToken(conn.refreshTokenEncrypted);
  const accessToken = await refreshAccessToken(refreshToken);
  return { accessToken, calendarId: conn.calendarId || 'primary' };
}

export async function upsertGoogleConnection(
  userId: Types.ObjectId,
  refreshToken: string,
  calendarId = 'primary'
): Promise<void> {
  await connectDB();
  await UserCalendarConnection.findOneAndUpdate(
    { userId },
    {
      userId,
      provider: 'google',
      refreshTokenEncrypted: encryptToken(refreshToken),
      calendarId,
      syncedAt: new Date(),
    },
    { upsert: true, new: true }
  );
}
