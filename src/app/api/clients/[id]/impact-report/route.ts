import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Client from '@/lib/models/Client';
import Project from '@/lib/models/Project';
import ContentItem from '@/lib/models/ContentItem';
import Meeting from '@/lib/models/Meeting';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { buildClientImpactReport } from '@/lib/clients/buildClientImpactReport';
import type { TimeframeType } from '@/lib/utils/dateUtils';

const VALID_TIMEFRAMES: TimeframeType[] = ['today', 'weekly', 'monthly', 'quarterly', 'yearly'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const { id } = await params;
    const client = await Client.findOne({ _id: id, organizationId: user.organizationId }).lean();
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const timeframeParam = searchParams.get('timeframe') ?? 'monthly';
    const referenceDateParam = searchParams.get('referenceDate');
    const timeframe = VALID_TIMEFRAMES.includes(timeframeParam as TimeframeType)
      ? (timeframeParam as TimeframeType)
      : 'monthly';
    const referenceDate = referenceDateParam ? new Date(referenceDateParam) : new Date();
    if (isNaN(referenceDate.getTime())) {
      return NextResponse.json({ error: 'Invalid referenceDate' }, { status: 400 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const projects = await Project.find({ userId: { $in: orgUserIds }, clientId: id }).lean();
    const projectIds = projects.map((p) => p._id);

    const [contentItems, meetings] = await Promise.all([
      projectIds.length > 0
        ? ContentItem.find({ projectId: { $in: projectIds } }).lean()
        : Promise.resolve([]),
      Meeting.find({
        organizationId: user.organizationId,
        linkedClientIds: id,
      }).lean(),
    ]);

    const report = buildClientImpactReport({
      client: {
        _id: client._id,
        name: client.name,
        color: client.color,
        logo: client.logo,
        domain: client.domain,
      },
      projects: projects as unknown as Parameters<typeof buildClientImpactReport>[0]['projects'],
      contentItems: contentItems as unknown as Parameters<typeof buildClientImpactReport>[0]['contentItems'],
      meetings: meetings.map((m) => ({
        _id: m._id,
        title: m.title,
        start: m.start,
        end: m.end,
        linkedClientIds: m.linkedClientIds,
      })),
      timeframe,
      referenceDate,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Failed to build client impact report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
