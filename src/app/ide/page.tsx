import { cookies } from 'next/headers';
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
  let initial =
    projectId && isRealIdeProjectId(projectId) ? projectId.trim() : undefined;
  if (!initial) {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get(IDE_LAST_PROJECT_COOKIE)?.value?.trim();
    if (isRealIdeProjectId(fromCookie)) initial = fromCookie;
  }
  return <IdeShell initialProjectId={initial} />;
}
