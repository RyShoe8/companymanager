export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
export const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
};

export type ShareWarning = {
  email: string;
  reason: string;
};

async function driveFetch(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
}

export async function createGoogleDriveFile(
  accessToken: string,
  name: string,
  mimeType: string
): Promise<GoogleDriveFile> {
  const res = await driveFetch(accessToken, '/files?fields=id,name,mimeType,webViewLink,iconLink,modifiedTime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Google file: ${err}`);
  }
  return res.json();
}

export async function getGoogleDriveFile(
  accessToken: string,
  fileId: string
): Promise<GoogleDriveFile> {
  const res = await driveFetch(
    accessToken,
    `/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink,iconLink,modifiedTime`
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to load Google file: ${err}`);
  }
  return res.json();
}

export async function uploadGoogleDriveFile(
  accessToken: string,
  name: string,
  mimeType: string,
  data: Buffer
): Promise<GoogleDriveFile> {
  const metadata = JSON.stringify({ name });
  const boundary = 'nucleas_drive_upload_boundary';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
    ),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,iconLink,modifiedTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload to Google Drive: ${err}`);
  }
  return res.json();
}

export async function shareGoogleDriveFile(
  accessToken: string,
  fileId: string,
  emails: string[]
): Promise<ShareWarning[]> {
  const warnings: ShareWarning[] = [];
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];

  for (const email of unique) {
    const res = await driveFetch(
      accessToken,
      `/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'user',
          role: 'writer',
          emailAddress: email,
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      warnings.push({ email, reason: err.slice(0, 200) || 'Share failed' });
    }
  }

  return warnings;
}

export function assetTypeForGoogleMime(mimeType: string): 'document' | 'spreadsheet' | 'file' {
  if (mimeType === GOOGLE_DOC_MIME) return 'document';
  if (mimeType === GOOGLE_SHEET_MIME) return 'spreadsheet';
  return 'file';
}
