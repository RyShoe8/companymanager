import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import Asset from '@/lib/models/Asset';
import ContentItem from '@/lib/models/ContentItem';

/**
 * GET /api/portal/[slug]?token=...
 * Public: returns project name, logo, urls, client-visible assets, and content calendar.
 * If project has clientPortalToken, token query param must match.
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

    const project = await Project.findOne({
      clientPortalSlug: slug,
      projectType: 'client',
    }).lean();

    if (!project) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    if (project.clientPortalToken && project.clientPortalToken !== token) {
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
      ContentItem.find({ projectId })
        .sort({ publishDate: 1 })
        .lean(),
    ]);

    const sanitized = {
      name: project.name,
      logo: project.logo,
      color: project.color,
      urls: project.urls && project.urls.length > 0 ? project.urls : (project.url ? [project.url] : []),
      assets: assets.map((a: any) => ({
        _id: a._id,
        name: a.name,
        type: a.type,
        url: a.url,
        fileUrl: a.fileUrl,
        textContent: a.textContent,
      })),
      contentCalendar: contentItems.map((c: any) => ({
        _id: c._id,
        title: c.title,
        channel: c.channel,
        status: c.status,
        publishDate: c.publishDate,
      })),
    };

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error('Portal API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
