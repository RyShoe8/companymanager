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
import type { ExtendUnit } from '@/lib/recurrence/recurrenceHorizons';
import {
  expandExtensionDates,
  sortByDateAsc,
} from '@/lib/recurrence/recurrenceHorizons';
import { expandExtensionContentRows } from '@/lib/recurrence/expandContentInstances';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const body = await request.json();
    const seriesId = typeof body.seriesId === 'string' ? body.seriesId.trim() : '';
    const unit = body.unit as ExtendUnit;

    if (!seriesId) {
      return NextResponse.json({ error: 'seriesId is required' }, { status: 400 });
    }
    if (unit !== 'week' && unit !== 'month' && unit !== 'year') {
      return NextResponse.json({ error: 'unit must be week, month, or year' }, { status: 400 });
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

    const items = await ContentItem.find({ recurrenceSeriesId: seriesId }).lean();
    if (items.length === 0) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    const projectId = items[0].projectId?.toString();
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: projectId, userId: { $in: orgUserIds } }).lean();
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

    const sorted = sortByDateAsc(items, (item) =>
      item.publishDate ? new Date(item.publishDate) : new Date(0)
    );
    const last = sorted[sorted.length - 1];
    const preset = (last.recurrencePreset as RecurrencePreset) ?? 'weekly';
    const lastDate = last.publishDate ? new Date(last.publishDate) : new Date();
    const extensionDates = expandExtensionDates(lastDate, preset, unit);
    if (extensionDates.length === 0) {
      return NextResponse.json({ addedCount: 0, items: sorted });
    }

    const template = {
      projectId: last.projectId,
      title: last.title,
      channel: last.channel,
      status: last.status,
      notes: last.notes,
      assignedToEmployeeId: last.assignedToEmployeeId,
      userId: last.userId,
      keywords: last.keywords,
      internalLinks: last.internalLinks,
      externalUrl: last.externalUrl,
      distributionMethods: last.distributionMethods,
      estimatedHours: last.estimatedHours,
    };

    const rows = expandExtensionContentRows(template, lastDate, preset, unit, seriesId);
    const created = await ContentItem.insertMany(rows);

    if (projectId) await touchProjectActivity(projectId);

    return NextResponse.json({
      addedCount: created.length,
      seriesId,
      totalCount: sorted.length + created.length,
    });
  } catch (error) {
    console.error('Error extending content series:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
