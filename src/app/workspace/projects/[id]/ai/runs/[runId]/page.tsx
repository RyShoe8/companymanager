import AiRunInspector from '@/components/ai/AiRunInspector';

export default async function AiRunPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  return <AiRunInspector key={`${id}:${runId}`} projectId={id} runId={runId} />;
}
