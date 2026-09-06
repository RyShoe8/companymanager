import AiLibraryItem from '@/components/ai/AiLibraryItem';

export default async function AiLibraryDetailPage({ params }: { params: Promise<{ id: string; kind: string; itemId: string }> }) {
  const { id, kind, itemId } = await params;
  return <AiLibraryItem key={`${id}:${kind}:${itemId}`} projectId={id} kind={kind} itemId={itemId} />;
}
