import ProjectAiPanel from '@/components/ai/ProjectAiPanel';

export default async function ProjectAiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectAiPanel key={id} projectId={id} />;
}
