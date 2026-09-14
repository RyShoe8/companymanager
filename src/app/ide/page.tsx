import IdeShell from '@/components/ide/IdeShell';

export const metadata = {
  title: 'IDE',
};

export default async function IdePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const initial =
    projectId && /^[a-f0-9]{24}$/i.test(projectId) ? projectId : undefined;
  return <IdeShell initialProjectId={initial} />;
}
