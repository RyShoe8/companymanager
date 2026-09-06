import AiLibrary from '@/components/ai/AiLibrary';

export default async function AiLibraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AiLibrary key={id} projectId={id} />;
}
