import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import Client from '@/lib/models/Client';
import Asset from '@/lib/models/Asset';
import ContentItem from '@/lib/models/ContentItem';

/**
 * GET /api/portal/[slug]?token=...
 * Public: resolves Client portal first, then legacy Project portal.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!slug) {
      return NextResponse.json({ error: 'Slug required' }, { status: 400 });
    }

    const client = await Client.findOne({ clientPortalSlug: slug }).lean();

    if (client) {
      if (!client.clientPortalToken || client.clientPortalToken !== token) {
        return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
      }

      const clientId = client._id;
      const linkedProjects = await Project.find({ clientId }).select('_id').lean();
      const projectIds = linkedProjects.map((p) => p._id);

      const assetQuery: Record<string, unknown> = {
        clientAccessible: true,
        $or: [{ linkedClientId: clientId }],
      };
      if (projectIds.length > 0) {
        (assetQuery.$or as unknown[]).push({
          linkedProjectId: { $in: projectIds },
          $and: [
            { $or: [{ linkedProjectTaskId: { $exists: false } }, { linkedProjectTaskId: null }] },
            { $or: [{ linkedContentItemId: { $exists: false } }, { linkedContentItemId: null }] },
          ],
        });
      }

      const [assets, contentItems] = await Promise.all([
        Asset.find(assetQuery).sort({ createdAt: -1 }).lean(),
        projectIds.length > 0
          ? ContentItem.find({ projectId: { $in: projectIds } }).sort({ publishDate: 1 }).lean()
          : Promise.resolve([]),
      ]);

      const urls: string[] = [];
      if (client.devUrl) urls.push(client.devUrl);
      if (client.liveUrl) urls.push(client.liveUrl);
      if (urls.length === 0 && client.urls?.length) urls.push(...client.urls);
      if (urls.length === 0 && client.url) urls.push(client.url);

      return NextResponse.json({
        portalType: 'client',
        name: client.name,
        logo: client.logo,
        color: client.color,
        urls,
        assets: assets.map((a) => ({
          _id: a._id,
          name: a.name,
          type: a.type,
          url: a.url,
          fileUrl: a.fileUrl,
          textContent: a.textContent,
        })),
        contentCalendar: contentItems.map((c) => ({
          _id: c._id,
          title: c.title,
          channel: c.channel,
          status: c.status,
          publishDate: c.publishDate,
        })),
      });
    }

    const project = await Project.findOne({
      clientPortalSlug: slug,
      projectType: 'client',
    }).lean();

    if (!project) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    if (!project.clientPortalToken || project.clientPortalToken !== token) {
      return NextResponse.json({ error: 'Invalid or missing token' }, { status: 403 });
    }

    const projectId = project._id;

    const [assets, contentItems] = await Promise.all([
      Asset.find({
        linkedProjectId: projectId,
        clientAccessible: true,
      })
        .sort({ createdAt: -1 })
        .lean(),
      ContentItem.find({ projectId }).sort({ publishDate: 1 }).lean(),
    ]);

    const urls =
      project.urls && project.urls.length > 0
        ? project.urls
        : project.url
          ? [project.url]
          : [];
    if (project.devUrl && !urls.includes(project.devUrl)) urls.unshift(project.devUrl);
    if (project.liveUrl && !urls.includes(project.liveUrl)) urls.push(project.liveUrl);

    return NextResponse.json({
      portalType: 'project',
      name: project.name,
      logo: project.logo,
      color: project.color,
      urls,
      assets: assets.map((a) => ({
        _id: a._id,
        name: a.name,
        type: a.type,
        url: a.url,
        fileUrl: a.fileUrl,
        textContent: a.textContent,
      })),
      contentCalendar: contentItems.map((c) => ({
        _id: c._id,
        title: c.title,
        channel: c.channel,
        status: c.status,
        publishDate: c.publishDate,
      })),
    });
  } catch (error) {
    console.error('Portal API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
