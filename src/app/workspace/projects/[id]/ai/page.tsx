import ProjectAiPanel from '@/components/ai/ProjectAiPanel';

export default async function ProjectAiPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ objectiveId?: string }> }) {
  const { id } = await params;
  const { objectiveId } = await searchParams;
  return <ProjectAiPanel key={`${id}:${objectiveId ?? ''}`} projectId={id} initialObjectiveId={objectiveId} />;
}
