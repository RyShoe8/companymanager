import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import {
  createGoogleDriveFile,
  getGoogleDriveFile,
  shareGoogleDriveFile,
  uploadGoogleDriveFile,
  GOOGLE_DOC_MIME,
  GOOGLE_SHEET_MIME,
  assetTypeForGoogleMime,
  type GoogleDriveFile,
} from '@/lib/google/drive';
import { getGoogleDriveAccessTokenForUser } from '@/lib/google/driveConnection';
import {
  createGoogleLinkedAsset,
  parseGoogleAssetLinkFields,
  type GoogleAssetLinkFields,
} from '@/lib/google/createGoogleLinkedAsset';
import { resolveShareEmailsForAssetLink } from '@/lib/google/resolveShareEmails';

export async function requireDriveAccessToken(
  userId: string
): Promise<{ accessToken: string } | NextResponse> {
  const accessToken = await getGoogleDriveAccessTokenForUser(new Types.ObjectId(userId));
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google Drive not connected', code: 'GOOGLE_DRIVE_NOT_CONNECTED' },
      { status: 403 }
    );
  }
  return { accessToken };
}

export async function finalizeGoogleFileAsAsset(
  session: { userId: string },
  file: GoogleDriveFile,
  options: {
    name?: string;
    type?: 'document' | 'spreadsheet' | 'file';
    linkFields: GoogleAssetLinkFields;
  }
): Promise<NextResponse> {
  const accessToken = await getGoogleDriveAccessTokenForUser(new Types.ObjectId(session.userId));
  if (!accessToken) {
    return NextResponse.json({ error: 'Google Drive not connected' }, { status: 403 });
  }

  const shareEmails = await resolveShareEmailsForAssetLink({
    actingUserId: session.userId,
    linkedProjectId: options.linkFields.linkedProjectId,
    linkedClientId: options.linkFields.linkedClientId,
  });
  const shareWarnings = await shareGoogleDriveFile(accessToken, file.id, shareEmails);

  const assetType = options.type ?? assetTypeForGoogleMime(file.mimeType);
  const webViewLink =
    file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`;

  const assetResponse = await createGoogleLinkedAsset(session, {
    name: (options.name ?? file.name).trim(),
    type: assetType,
    url: webViewLink,
    googleFileId: file.id,
    googleMimeType: file.mimeType,
    ...options.linkFields,
  });

  if (assetResponse.status !== 201) return assetResponse;

  const asset = await assetResponse.json();
  return NextResponse.json({ asset, shareWarnings }, { status: 201 });
}

export async function createGoogleDocAsset(
  session: { userId: string },
  name: string,
  linkFields: GoogleAssetLinkFields
): Promise<NextResponse> {
  const tokenResult = await requireDriveAccessToken(session.userId);
  if (tokenResult instanceof NextResponse) return tokenResult;

  const file = await createGoogleDriveFile(tokenResult.accessToken, name.trim(), GOOGLE_DOC_MIME);
  return finalizeGoogleFileAsAsset(session, file, { name, type: 'document', linkFields });
}

export async function createGoogleSheetAsset(
  session: { userId: string },
  name: string,
  linkFields: GoogleAssetLinkFields
): Promise<NextResponse> {
  const tokenResult = await requireDriveAccessToken(session.userId);
  if (tokenResult instanceof NextResponse) return tokenResult;

  const file = await createGoogleDriveFile(tokenResult.accessToken, name.trim(), GOOGLE_SHEET_MIME);
  return finalizeGoogleFileAsAsset(session, file, { name, type: 'spreadsheet', linkFields });
}

export async function attachGoogleDriveFileAsset(
  session: { userId: string },
  googleFileId: string,
  linkFields: GoogleAssetLinkFields,
  name?: string
): Promise<NextResponse> {
  const tokenResult = await requireDriveAccessToken(session.userId);
  if (tokenResult instanceof NextResponse) return tokenResult;

  const file = await getGoogleDriveFile(tokenResult.accessToken, googleFileId);
  return finalizeGoogleFileAsAsset(session, file, { name, linkFields });
}

export async function uploadGoogleDriveFileAsset(
  session: { userId: string },
  name: string,
  mimeType: string,
  data: Buffer,
  linkFields: GoogleAssetLinkFields
): Promise<NextResponse> {
  const tokenResult = await requireDriveAccessToken(session.userId);
  if (tokenResult instanceof NextResponse) return tokenResult;

  const file = await uploadGoogleDriveFile(
    tokenResult.accessToken,
    name.trim(),
    mimeType,
    data
  );
  return finalizeGoogleFileAsAsset(session, file, { name, type: 'file', linkFields });
}

export { parseGoogleAssetLinkFields };
