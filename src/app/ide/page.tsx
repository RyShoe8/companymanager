import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import IdeShell from '@/components/ide/IdeShell';
import { IDE_LAST_PROJECT_COOKIE, isRealIdeProjectId } from '@/lib/ide/ideProjectCookie';

export const metadata = {
  title: 'IDE',
};

export default async function IdePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  if (projectId && isRealIdeProjectId(projectId)) {
    return <IdeShell initialProjectId={projectId.trim()} />;
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(IDE_LAST_PROJECT_COOKIE)?.value?.trim();
  if (isRealIdeProjectId(fromCookie)) {
    redirect(`/ide?projectId=${encodeURIComponent(fromCookie)}`);
  }

  return <IdeShell />;
}
