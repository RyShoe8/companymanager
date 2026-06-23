import crypto from 'crypto';
import { Types } from 'mongoose';
import type { IClient } from '@/lib/models/Client';
import type { IProject } from '@/lib/models/Project';
import { parseCssColorInput } from '@/lib/utils/cssColorInput';
import { labelForFontPaletteIndex, maxFontPaletteEntries, parseFontFamilyInput } from '@/lib/utils/fontPaletteInput';
import { sanitizeSocialLinks, validateSocialLinksUpdate } from '@/lib/utils/socialUrls';
import { sanitizeTechStack, validateTechStackUpdate } from '@/lib/utils/techStack';
import { sanitizeMarketingStack, validateMarketingStackUpdate } from '@/lib/utils/marketingStack';

const CRM_FIELDS = new Set([
  'name',
  'contactName',
  'contactEmail',
  'contactPhone',
  'domain',
  'description',
  'logo',
  'color',
  'status',
  'assignedToEmployeeIds',
]);

const OPS_FIELDS = new Set([
  'url',
  'urls',
  'devUrl',
  'liveUrl',
  'socialLinks',
  'socialsToolbarVisible',
  'techStack',
  'marketingStack',
  'colorPalette',
  'fontPalette',
  'actionButtons',
  'clientPortalSlug',
  'clientPortalToken',
  'invitedClientEmails',
]);

export function sanitizeClientForResponse(
  client: Record<string, unknown> | object,
  _isManagerOrAdmin: boolean
): Record<string, unknown> {
  return { ...(client as Record<string, unknown>) };
}

export type ClientUpdateResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const SPECIAL_FIELDS = new Set(['ensurePortal', 'generatePortal']);

/** Apply whitelisted client updates to a Mongoose document. */
export function applyClientUpdates(
  client: IClient,
  body: Record<string, unknown>,
  isManagerOrAdmin: boolean
): ClientUpdateResult {
  const forbiddenKeys = Object.keys(body).filter(
    (k) =>
      k !== '_id' &&
      !CRM_FIELDS.has(k) &&
      !OPS_FIELDS.has(k) &&
      !SPECIAL_FIELDS.has(k)
  );
  if (forbiddenKeys.length > 0) {
    return { ok: false, status: 400, error: `Unknown fields: ${forbiddenKeys.join(', ')}` };
  }

  if (!isManagerOrAdmin) {
    const opsKeys = Object.keys(body).filter((k) => OPS_FIELDS.has(k));
    if (opsKeys.length > 0) {
      return { ok: false, status: 403, error: 'Only Managers and Administrators can update client operations fields' };
    }
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return { ok: false, status: 400, error: 'Client name is required' };
    client.name = name;
  }
  if (body.contactName !== undefined) client.contactName = body.contactName ? String(body.contactName).trim() : undefined;
  if (body.contactEmail !== undefined) client.contactEmail = body.contactEmail ? String(body.contactEmail).trim().toLowerCase() : undefined;
  if (body.contactPhone !== undefined) client.contactPhone = body.contactPhone ? String(body.contactPhone).trim() : undefined;
  if (body.domain !== undefined) client.domain = body.domain ? String(body.domain).trim().toLowerCase() : undefined;
  if (body.description !== undefined) {
    client.description = body.description ? String(body.description).trim() : undefined;
  }
  if (body.logo !== undefined) client.logo = body.logo ? String(body.logo).trim() : undefined;
  if (body.color !== undefined) client.color = String(body.color).trim() || '#3b82f6';
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!['active', 'inactive', 'lead'].includes(status)) {
      return { ok: false, status: 400, error: 'Invalid status' };
    }
    client.status = status as IClient['status'];
  }

  if (body.assignedToEmployeeIds !== undefined) {
    if (!Array.isArray(body.assignedToEmployeeIds)) {
      return { ok: false, status: 400, error: 'assignedToEmployeeIds must be an array' };
    }
    const unique = [
      ...new Set(
        body.assignedToEmployeeIds
          .map((id) => (id == null ? '' : String(id).trim()))
          .filter(Boolean)
      ),
    ];
    for (const id of unique) {
      if (!Types.ObjectId.isValid(id)) {
        return { ok: false, status: 400, error: `Invalid employee id: ${id}` };
      }
    }
    if (unique.length === 0) {
      client.assignedToEmployeeIds = [];
      client.assignedToEmployeeId = undefined;
    } else {
      client.assignedToEmployeeIds = unique.map((id) => new Types.ObjectId(id));
      client.assignedToEmployeeId = client.assignedToEmployeeIds[0];
    }
  }

  if (body.url !== undefined) client.url = body.url ? String(body.url).trim() : undefined;
  if (body.urls !== undefined) {
    if (!Array.isArray(body.urls)) return { ok: false, status: 400, error: 'urls must be an array' };
    client.urls = body.urls.map((u) => String(u).trim()).filter(Boolean);
  }
  if (body.devUrl !== undefined) {
    client.devUrl = body.devUrl === null || body.devUrl === '' ? undefined : String(body.devUrl).trim() || undefined;
  }
  if (body.liveUrl !== undefined) {
    client.liveUrl = body.liveUrl === null || body.liveUrl === '' ? undefined : String(body.liveUrl).trim() || undefined;
  }
  if (body.socialLinks !== undefined) {
    const socialError = validateSocialLinksUpdate(body.socialLinks);
    if (socialError) return { ok: false, status: 400, error: socialError };
    client.socialLinks = sanitizeSocialLinks(body.socialLinks) ?? [];
  }
  if (body.socialsToolbarVisible !== undefined) {
    client.socialsToolbarVisible = body.socialsToolbarVisible !== false;
  }
  if (body.techStack !== undefined) {
    const techStackError = validateTechStackUpdate(body.techStack);
    if (techStackError) return { ok: false, status: 400, error: techStackError };
    client.techStack = sanitizeTechStack(body.techStack) ?? [];
  }
  if (body.marketingStack !== undefined) {
    const marketingStackError = validateMarketingStackUpdate(body.marketingStack);
    if (marketingStackError) return { ok: false, status: 400, error: marketingStackError };
    client.marketingStack = sanitizeMarketingStack(body.marketingStack) ?? [];
  }
  if (body.colorPalette !== undefined) {
    if (!Array.isArray(body.colorPalette)) return { ok: false, status: 400, error: 'colorPalette must be an array' };
    const sanitized: string[] = [];
    for (let i = 0; i < body.colorPalette.length; i++) {
      const item = body.colorPalette[i];
      if (typeof item !== 'string') return { ok: false, status: 400, error: `Invalid color at index ${i}` };
      const t = item.trim();
      if (!t) continue;
      const parsed = parseCssColorInput(t);
      if (!parsed.ok) return { ok: false, status: 400, error: `Invalid color at index ${i}: ${t}` };
      sanitized.push(parsed.normalized);
    }
    client.colorPalette = sanitized;
    if (sanitized.length > 0) client.color = sanitized[0];
  }
  if (body.fontPalette !== undefined) {
    if (!Array.isArray(body.fontPalette)) return { ok: false, status: 400, error: 'fontPalette must be an array' };
    if (body.fontPalette.length > maxFontPaletteEntries) {
      return { ok: false, status: 400, error: `fontPalette cannot exceed ${maxFontPaletteEntries} entries` };
    }
    const sanitizedFonts: string[] = [];
    for (let i = 0; i < body.fontPalette.length; i++) {
      const item = body.fontPalette[i];
      if (typeof item !== 'string') return { ok: false, status: 400, error: `Invalid font at index ${i}` };
      const t = item.trim();
      if (!t) continue;
      const parsed = parseFontFamilyInput(t);
      if (!parsed.ok) {
        return {
          ok: false,
          status: 400,
          error: `Invalid ${labelForFontPaletteIndex(i)}: ${t}`,
        };
      }
      sanitizedFonts.push(parsed.normalized);
    }
    if (sanitizedFonts.length === 0 && body.fontPalette.length > 0) {
      return { ok: false, status: 400, error: 'fontPalette must include at least one valid font' };
    }
    client.fontPalette = sanitizedFonts.length > 0 ? sanitizedFonts : undefined;
  }
  if (body.clientPortalSlug !== undefined) {
    client.clientPortalSlug = body.clientPortalSlug ? String(body.clientPortalSlug).trim() : undefined;
  }
  if (body.clientPortalToken !== undefined) {
    client.clientPortalToken = body.clientPortalToken ? String(body.clientPortalToken).trim() : undefined;
  }
  if (body.invitedClientEmails !== undefined) {
    if (!Array.isArray(body.invitedClientEmails)) {
      return { ok: false, status: 400, error: 'invitedClientEmails must be an array' };
    }
    client.invitedClientEmails = body.invitedClientEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  }

  if (!client.clientPortalSlug && (body.generatePortal === true || body.ensurePortal === true)) {
    client.clientPortalSlug = crypto.randomBytes(12).toString('base64url');
    client.clientPortalToken = crypto.randomBytes(24).toString('base64url');
  }

  return { ok: true };
}

/** Copy hub project ops fields onto client when client fields are empty. */
export function migrateHubOpsToClient(client: IClient, hubProject: IProject | null): boolean {
  if (!hubProject) return false;
  let changed = false;

  const copyIfEmpty = <K extends keyof IClient>(key: K, value: IClient[K] | undefined) => {
    const current = client[key];
    const isEmpty =
      current === undefined ||
      current === null ||
      (Array.isArray(current) && current.length === 0) ||
      (typeof current === 'string' && !current.trim());
    if (isEmpty && value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0)) {
      (client as unknown as Record<string, unknown>)[key as string] = value;
      changed = true;
    }
  };

  copyIfEmpty('devUrl', hubProject.devUrl);
  copyIfEmpty('liveUrl', hubProject.liveUrl);
  copyIfEmpty('url', hubProject.url);
  copyIfEmpty('urls', hubProject.urls);
  copyIfEmpty('socialLinks', hubProject.socialLinks);
  copyIfEmpty('techStack', hubProject.techStack);
  copyIfEmpty('marketingStack', hubProject.marketingStack);
  copyIfEmpty('actionButtons', hubProject.actionButtons);
  copyIfEmpty('logo', hubProject.logo);
  copyIfEmpty('colorPalette', hubProject.colorPalette);
  copyIfEmpty('fontPalette', hubProject.fontPalette);
  if (!client.clientPortalSlug && hubProject.clientPortalSlug) {
    client.clientPortalSlug = hubProject.clientPortalSlug;
    client.clientPortalToken = hubProject.clientPortalToken;
    changed = true;
  }

  return changed;
}

export function clientIdStr(id: Types.ObjectId | string | undefined): string {
  if (!id) return '';
  return typeof id === 'string' ? id : id.toString();
}
