import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import Asset, { type AssetType, type IAsset } from '@/lib/models/Asset';
import { validateAssetLinkExclusivity } from '@/lib/assets/validateAssetLinks';
import {
  assertCanLinkAsset,
  buildAssetAccessScope,
  getAssetSessionContext,
} from '@/lib/assets/assetAccess';

export type GoogleAssetLinkBody = {
  name: string;
  type: AssetType;
  url: string;
  googleFileId: string;
  googleMimeType: string;
  linkedProjectId?: string;
  linkedClientId?: string;
  linkedProjectTaskIndex?: number;
  linkedProjectTaskId?: string;
  linkedContentItemId?: string;
  clientAccessible?: boolean;
  tags?: string[];
};

export type CreateGoogleLinkedAssetResult =
  | { ok: true; asset: IAsset }
  | { ok: false; error: string; status: number };

export async function createGoogleLinkedAssetRecord(
  session: { userId: string },
  body: GoogleAssetLinkBody
): Promise<CreateGoogleLinkedAssetResult> {
  const {
    name,
    type,
    url,
    googleFileId,
    googleMimeType,
    linkedProjectId,
    linkedClientId,
    linkedProjectTaskIndex,
    linkedProjectTaskId,
    linkedContentItemId,
    clientAccessible,
    tags,
  } = body;

  if (!name?.trim() || !type || !googleFileId || !url) {
    return { ok: false, error: 'Name, type, googleFileId, and url are required', status: 400 };
  }

  const linkError = validateAssetLinkExclusivity({
    linkedClientId,
    linkedProjectId,
    linkedProjectTaskId,
    linkedProjectTaskIndex,
    linkedContentItemId,
  });
  if (linkError) {
    return { ok: false, error: linkError, status: 400 };
  }

  await connectDB();

  const ctx = await getAssetSessionContext(session.userId);
  if (ctx instanceof NextResponse) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  const scope = ctx.isManagerOrAdmin ? null : await buildAssetAccessScope(ctx);
  const linkDenied = await assertCanLinkAsset(
    ctx,
    {
      linkedProjectId,
      linkedClientId,
      linkedProjectTaskId,
      linkedProjectTaskIndex,
      linkedContentItemId,
    },
    scope ?? undefined
  );
  if (linkDenied) {
    const deniedBody = await linkDenied.json().catch(() => ({}));
    const message =
      typeof deniedBody === 'object' &&
      deniedBody &&
      'error' in deniedBody &&
      typeof deniedBody.error === 'string'
        ? deniedBody.error
        : 'Cannot link asset';
    return { ok: false, error: message, status: linkDenied.status };
  }

  const assetData: Record<string, unknown> = {
    name: name.trim(),
    type,
    url,
    googleFileId,
    googleMimeType,
    googleConnectedByUserId: new Types.ObjectId(session.userId),
    tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()) : [],
    clientAccessible: clientAccessible === true,
    userId: session.userId,
  };

  if (linkedClientId && Types.ObjectId.isValid(linkedClientId)) {
    assetData.linkedClientId = new Types.ObjectId(linkedClientId);
  }
  if (linkedProjectId && Types.ObjectId.isValid(linkedProjectId)) {
    assetData.linkedProjectId = new Types.ObjectId(linkedProjectId);
  }
  if (linkedProjectTaskId && Types.ObjectId.isValid(linkedProjectTaskId)) {
    assetData.linkedProjectTaskId = new Types.ObjectId(linkedProjectTaskId);
  } else if (linkedProjectTaskIndex !== undefined && linkedProjectTaskIndex !== null) {
    assetData.linkedProjectTaskIndex = linkedProjectTaskIndex;
  }
  if (linkedContentItemId && Types.ObjectId.isValid(linkedContentItemId)) {
    assetData.linkedContentItemId = new Types.ObjectId(linkedContentItemId);
  }

  const asset = await Asset.create(assetData);
  return { ok: true, asset };
}

export async function createGoogleLinkedAsset(
  session: { userId: string },
  body: GoogleAssetLinkBody
): Promise<NextResponse> {
  const result = await createGoogleLinkedAssetRecord(session, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.asset, { status: 201 });
}

export type GoogleAssetLinkFields = Pick<
  GoogleAssetLinkBody,
  | 'linkedProjectId'
  | 'linkedClientId'
  | 'linkedProjectTaskIndex'
  | 'linkedProjectTaskId'
  | 'linkedContentItemId'
  | 'clientAccessible'
>;

export function parseGoogleAssetLinkFields(body: Record<string, unknown>): GoogleAssetLinkFields {
  return {
    linkedProjectId:
      typeof body.linkedProjectId === 'string' ? body.linkedProjectId : undefined,
    linkedClientId:
      typeof body.linkedClientId === 'string' ? body.linkedClientId : undefined,
    linkedProjectTaskId:
      typeof body.linkedProjectTaskId === 'string' ? body.linkedProjectTaskId : undefined,
    linkedProjectTaskIndex:
      typeof body.linkedProjectTaskIndex === 'number'
        ? body.linkedProjectTaskIndex
        : typeof body.linkedProjectTaskIndex === 'string' && body.linkedProjectTaskIndex !== ''
          ? Number(body.linkedProjectTaskIndex)
          : undefined,
    linkedContentItemId:
      typeof body.linkedContentItemId === 'string' ? body.linkedContentItemId : undefined,
    clientAccessible: body.clientAccessible === true,
  };
}
