import '@/lib/billing-engine';
import { billing } from '@/lib/billing-engine';

export const dynamic = 'force-dynamic';
export const GET = billing.handlers.adminPlansGet;
export const POST = billing.handlers.adminPlansPost;
