import AiBudgetSettingsPanel from '@/components/ai/AiBudgetSettingsPanel';

export default async function AiBudgetPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  return <AiBudgetSettingsPanel key={projectId ?? 'organization'} projectId={projectId} />;
}
