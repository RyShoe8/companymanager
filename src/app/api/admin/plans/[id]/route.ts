import '@/lib/billing-engine';
import { billing } from '@/lib/billing-engine';

export const dynamic = 'force-dynamic';
export const GET = billing.handlers.adminPlanByIdGet;
export const PATCH = billing.handlers.adminPlanByIdPatch;
export const DELETE = billing.handlers.adminPlanByIdDelete;
