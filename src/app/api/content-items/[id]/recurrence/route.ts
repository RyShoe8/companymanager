import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import ContentItem from '@/lib/models/ContentItem';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { canUserContributeToProject } from '@/lib/utils/projectTeam';
import { touchProjectActivity } from '@/lib/projects/touchProjectActivity';
import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import {
  expandInitialContentRows,
} from '@/lib/recurrence/expandContentInstances';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const preset = body.preset as RecurrencePreset;

    if (!preset || preset === 'none') {
      return NextResponse.json({ error: 'preset is required' }, { status: 400 });
    }

    const user = await User.findById(session.userId);
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const currentUserEmployee = await Employee.findOne({
      userId: session.userId,
      organizationId: user.organizationId,
    });
    const isManagerOrAdmin =
      currentUserEmployee?.role === 'Manager' || currentUserEmployee?.role === 'Administrator';

    const item = await ContentItem.findById(id);
    if (!item) {
      return NextResponse.json({ error: 'Content item not found' }, { status: 404 });
    }
    if (item.recurrenceSeriesId) {
      return NextResponse.json({ error: 'Content item is already part of a series' }, { status: 400 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: item.projectId, userId: { $in: orgUserIds } }).lean();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (
      !canUserContributeToProject(
        project as Parameters<typeof canUserContributeToProject>[0],
        currentUserEmployee?._id?.toString() ?? null,
        Boolean(isManagerOrAdmin)
      )
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const anchorDate = item.publishDate ? new Date(item.publishDate) : new Date();
    const template = {
      projectId: item.projectId,
      title: item.title,
      channel: item.channel,
      status: item.status,
      notes: item.notes,
      assignedToEmployeeId: item.assignedToEmployeeId,
      userId: item.userId,
      keywords: item.keywords,
      internalLinks: item.internalLinks,
      externalUrl: item.externalUrl,
      distributionMethods: item.distributionMethods,
      estimatedHours: item.estimatedHours,
    };

    const rows = expandInitialContentRows(template, anchorDate, preset);
    const seriesId = rows[0]?.recurrenceSeriesId as string;

    item.recurrenceSeriesId = seriesId;
    item.recurrencePreset = preset;
    await item.save();

    const additionalRows = rows.slice(1);
    if (additionalRows.length > 0) {
      await ContentItem.insertMany(additionalRows);
    }

    await touchProjectActivity(item.projectId.toString());

    const total = await ContentItem.countDocuments({ recurrenceSeriesId: seriesId });

    return NextResponse.json({
      seriesId,
      totalCount: total,
      addedCount: rows.length,
    });
  } catch (error) {
    console.error('Error applying content recurrence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
