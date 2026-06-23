import connectDB from '@/lib/db/mongodb';
import UserGoogleDriveConnection from '@/lib/models/UserGoogleDriveConnection';
import { decryptToken, encryptToken } from '@/lib/scheduling/tokenCrypto';
import { refreshAccessToken } from '@/lib/google/oauth';
import { Types } from 'mongoose';

const DRIVE_CALLBACK_PATH = '/api/google/workspace/callback';

export function getDriveOAuthRedirectUri(requestOrigin?: string): string {
  if (process.env.GOOGLE_DRIVE_REDIRECT_URI) {
    return process.env.GOOGLE_DRIVE_REDIRECT_URI;
  }
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || requestOrigin;
  if (!base) {
    throw new Error('Drive OAuth redirect URI: set GOOGLE_DRIVE_REDIRECT_URI or NEXTAUTH_URL');
  }
  return `${base}${DRIVE_CALLBACK_PATH}`;
}

export async function getGoogleDriveAccessTokenForUser(
  userId: Types.ObjectId
): Promise<string | null> {
  await connectDB();
  const conn = await UserGoogleDriveConnection.findOne({ userId, provider: 'google' });
  if (!conn?.refreshTokenEncrypted) return null;
  const refreshToken = decryptToken(conn.refreshTokenEncrypted);
  return refreshAccessToken(refreshToken);
}

export async function isGoogleDriveConnected(userId: Types.ObjectId): Promise<boolean> {
  await connectDB();
  const conn = await UserGoogleDriveConnection.findOne({ userId, provider: 'google' })
    .select('_id')
    .lean();
  return !!conn;
}

export async function upsertGoogleDriveConnection(
  userId: Types.ObjectId,
  refreshToken: string
): Promise<void> {
  await connectDB();
  await UserGoogleDriveConnection.findOneAndUpdate(
    { userId },
    {
      userId,
      provider: 'google',
      refreshTokenEncrypted: encryptToken(refreshToken),
      connectedAt: new Date(),
    },
    { upsert: true, new: true }
  );
}

export async function disconnectGoogleDrive(userId: Types.ObjectId): Promise<void> {
  await connectDB();
  await UserGoogleDriveConnection.deleteOne({ userId, provider: 'google' });
}
