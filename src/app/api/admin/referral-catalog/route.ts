import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import ReferralCatalog from '@/lib/models/ReferralCatalog';
import type { ReferralCategory } from '@/lib/models/ReferralCatalog';

/**
 * GET /api/admin/referral-catalog
 * Returns the referral catalog for the current user's organization.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const Employee = (await import('@/lib/models/Employee')).default;
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (!employee || (employee.role !== 'Manager' && employee.role !== 'Administrator')) {
      return NextResponse.json({ error: 'Forbidden - Manager or Administrator required' }, { status: 403 });
    }

    const catalog = await ReferralCatalog.findOne({ organizationId: user.organizationId }).lean();
    return NextResponse.json(catalog || { entries: [], organizationId: user.organizationId });
  } catch (error) {
    console.error('Error fetching referral catalog:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/referral-catalog
 * Create or update referral catalog for the current user's organization. Manager/Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const Employee = (await import('@/lib/models/Employee')).default;
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (!employee || (employee.role !== 'Manager' && employee.role !== 'Administrator')) {
      return NextResponse.json({ error: 'Forbidden - Manager or Administrator required' }, { status: 403 });
    }

    const body = await request.json();
    const { entries } = body;

    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: 'entries must be an array' }, { status: 400 });
    }

    const validEntries = entries
      .map((e: any) => {
        const entry: any = {
          companyName: String(e.companyName || '').trim(),
          categoryName: e.categoryName ? String(e.categoryName).trim() : undefined,
          category: ['Plan', 'Build', 'Run'].includes(e.category) ? e.category : 'Plan',
          checklistSentence: e.checklistSentence ? String(e.checklistSentence).trim() : undefined,
          checklistNumber: typeof e.checklistNumber === 'number' ? e.checklistNumber : undefined,
          url: e.url ? String(e.url).trim() : undefined,
          imageUrl: e.imageUrl ? String(e.imageUrl).trim() : undefined,
          projectTypes: Array.isArray(e.projectTypes) ? e.projectTypes.filter((t: string) => ['website', 'store', 'app', 'generic'].includes(t)) : [],
        };
        if (e._id) entry._id = e._id;
        return entry;
      })
      .filter((e: any) => e.companyName);

    let catalog = await ReferralCatalog.findOne({ organizationId: user.organizationId });
    if (!catalog) {
      catalog = await ReferralCatalog.create({
        entries: validEntries,
        organizationId: user.organizationId,
      });
      return NextResponse.json(catalog, { status: 201 });
    }

    catalog.entries = validEntries;
    await catalog.save();

    return NextResponse.json(catalog);
  } catch (error) {
    console.error('Error updating referral catalog:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
