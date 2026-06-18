import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Client from '@/lib/models/Client';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import {
  ensureClientHubProject,
  findLegacyDeliverableProject,
  transitionDeliverableWorkToHub,
} from '@/lib/clients/transitionClientHubWork';

type MigrateClientHubWorkBody = {
  clientName?: string;
  dryRun?: boolean;
};

/**
 * POST /api/admin/migrate-client-hub-work
 * One-time migration: ensure client-admin hub exists and move tasks/content from
 * legacy deliverable project (same name) into the hub.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const Employee = (await import('@/lib/models/Employee')).default;
    const currentUserEmployee = await Employee.findOne({
      userId: session.userId,
      organizationId: user.organizationId,
    });
    if (currentUserEmployee?.role !== 'Administrator') {
      return NextResponse.json({ error: 'Only administrators can migrate data' }, { status: 403 });
    }

    let body: MigrateClientHubWorkBody = {};
    try {
      body = (await request.json()) as MigrateClientHubWorkBody;
    } catch {
      // Empty body is valid
    }

    const { clientName, dryRun = false } = body;
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const projects = await Project.find({ userId: { $in: orgUserIds } });

    const clientQuery: { organizationId: typeof user.organizationId; name?: string } = {
      organizationId: user.organizationId,
    };
    if (clientName?.trim()) {
      clientQuery.name = clientName.trim();
    }

    const clients = await Client.find(clientQuery).sort({ name: 1 });

    const results: Array<{
      clientId: string;
      clientName: string;
      hubProjectId?: string;
      hubCreated?: boolean;
      sourceProjectId?: string;
      skipped?: boolean;
      reason?: string;
      tasksMoved: number;
      contentMoved: number;
      assetsRelinked: number;
      commentsUpdated: number;
      recordingsUpdated: number;
      dryRun: boolean;
    }> = [];

    for (const client of clients) {
      const ownerUserId =
        client.userIds?.[0] ??
        projects.find((p) => p.clientId?.toString() === client._id.toString())?.userId ??
        session.userId;

      let hub = projects.find(
        (p) =>
          p.projectType === 'client-admin' && p.clientId?.toString() === client._id.toString()
      );
      let hubCreated = false;

      if (!hub && !dryRun) {
        const ensured = await ensureClientHubProject(client, ownerUserId, projects);
        hub = ensured.hub;
        hubCreated = ensured.created;
        if (hubCreated) {
          projects.push(hub);
        }
      } else if (!hub && dryRun) {
        hubCreated = true;
      }

      if (!hub) {
        const sourceOnly = findLegacyDeliverableProject(client, projects);
        results.push({
          clientId: client._id.toString(),
          clientName: client.name,
          hubCreated: true,
          sourceProjectId: sourceOnly?._id.toString(),
          skipped: !sourceOnly,
          reason: sourceOnly
            ? 'Hub would be created on run; dry-run transition counts omitted without hub document'
            : 'No legacy deliverable project found',
          tasksMoved: sourceOnly?.tasks?.length ?? 0,
          contentMoved: 0,
          assetsRelinked: 0,
          commentsUpdated: 0,
          recordingsUpdated: 0,
          dryRun,
        });
        continue;
      }

      const source = findLegacyDeliverableProject(client, projects);
      if (!source) {
        results.push({
          clientId: client._id.toString(),
          clientName: client.name,
          hubProjectId: hub._id.toString(),
          hubCreated,
          skipped: true,
          reason: 'No legacy deliverable project found',
          tasksMoved: 0,
          contentMoved: 0,
          assetsRelinked: 0,
          commentsUpdated: 0,
          recordingsUpdated: 0,
          dryRun,
        });
        continue;
      }

      const sourceDoc = await Project.findById(source._id);
      const hubDoc = await Project.findById(hub._id);
      if (!sourceDoc || !hubDoc) {
        results.push({
          clientId: client._id.toString(),
          clientName: client.name,
          hubProjectId: hub._id.toString(),
          hubCreated,
          sourceProjectId: source._id.toString(),
          skipped: true,
          reason: 'Project document not found',
          tasksMoved: 0,
          contentMoved: 0,
          assetsRelinked: 0,
          commentsUpdated: 0,
          recordingsUpdated: 0,
          dryRun,
        });
        continue;
      }

      const transition = await transitionDeliverableWorkToHub({
        sourceProject: sourceDoc,
        hubProject: hubDoc,
        orgUserIds,
        dryRun,
      });

      results.push({
        clientId: client._id.toString(),
        clientName: client.name,
        hubProjectId: hub._id.toString(),
        hubCreated,
        sourceProjectId: source._id.toString(),
        skipped: transition.skipped,
        reason: transition.reason,
        tasksMoved: transition.tasksMoved,
        contentMoved: transition.contentMoved,
        assetsRelinked: transition.assetsRelinked,
        commentsUpdated: transition.commentsUpdated,
        recordingsUpdated: transition.recordingsUpdated,
        dryRun,
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      clientsProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error('Failed to migrate client hub work:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
