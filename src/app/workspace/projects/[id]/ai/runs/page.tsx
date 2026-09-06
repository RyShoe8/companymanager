import ProjectAiRuns from '@/components/ai/ProjectAiRuns';

export default async function AiRunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectAiRuns key={id} projectId={id} />;
}
