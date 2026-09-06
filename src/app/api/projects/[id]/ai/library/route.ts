import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { libraryKindSchema, listLibrary } from '@/lib/ai/control/libraryQueries';
import { aiError, aiResponse } from '@/lib/ai/control/http';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const kind = libraryKindSchema.parse(request.nextUrl.searchParams.get('kind') ?? 'objectives');
    return aiResponse(await listLibrary(access, kind, request.nextUrl.searchParams.get('cursor')));
  } catch (error) { return aiError(error); }
}
