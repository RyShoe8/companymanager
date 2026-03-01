import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import ReferralCatalog from '@/lib/models/ReferralCatalog';
/**
 * GET /api/referral-catalog?phase=Plan&projectType=website&q=vercel
 * Returns catalog entries for the current org, filtered by phase and project type.
 * Used for checklist template and Add autocomplete.
 * - phase: Plan | Build | Run
 * - projectType: website | store | app | generic
 * - q: optional search query for autocomplete (filters by companyName)
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

    const { searchParams } = new URL(request.url);
    const phase = searchParams.get('phase') as 'Plan' | 'Build' | 'Run' | null;
    const projectType = searchParams.get('projectType') as string | null;
    const linkType = searchParams.get('linkType') as string | null;
    const q = searchParams.get('q')?.toLowerCase().trim();

    const catalog = await ReferralCatalog.findOne({ organizationId: user.organizationId }).lean();
    let entries = (catalog?.entries || []) as Array<{
      _id: string;
      companyName: string;
      categoryName?: string;
      category: string;
      checklistSentence?: string;
      checklistNumber?: number;
      url?: string;
      projectTypes?: string[];
    }>;

    if (phase) {
      entries = entries.filter((e) => e.category === phase);
    }

    if (projectType !== null && projectType !== '') {
      entries = entries.filter((e) => {
        if (!e.projectTypes || e.projectTypes.length === 0) return true;
        return e.projectTypes.includes(projectType);
      });
    }

    if (linkType) {
      const lt = linkType.toLowerCase();
      entries = entries.filter((e: any) => {
        const entryLinkType = (e.linkType || '').toLowerCase();
        const entryCategory = (e.categoryName || '').toLowerCase();
        return entryLinkType === lt || entryCategory === lt;
      });
    }

    if (q) {
      entries = entries.filter((e: any) =>
        e.companyName.toLowerCase().includes(q) ||
        (e.checklistSentence && e.checklistSentence.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error fetching referral catalog:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
