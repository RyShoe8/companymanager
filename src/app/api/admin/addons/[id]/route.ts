import '@/lib/billing-engine';
import { billing } from '@/lib/billing-engine';

export const dynamic = 'force-dynamic';
export const GET = billing.handlers.adminAddonByIdGet;
export const PATCH = billing.handlers.adminAddonByIdPatch;
export const DELETE = billing.handlers.adminAddonByIdDelete;
