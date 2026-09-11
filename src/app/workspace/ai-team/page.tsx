import AiTeamWorkspace from '@/components/ai/AiTeamWorkspace';
import { aiEmployeeSchema } from '@/lib/ai/teamWorkspace';
export default async function AiTeamPage({ searchParams }: { searchParams: Promise<{ projectId?: string; employee?: string; kind?: string }> }) {
  const { projectId, employee, kind } = await searchParams;
  const role = aiEmployeeSchema.safeParse(employee);
  return <AiTeamWorkspace initialProjectId={/^[a-f0-9]{24}$/i.test(projectId ?? '') ? projectId : undefined}
    initialEmployee={role.success ? role.data : undefined} initialView={kind === 'task' ? 'task' : 'message'} />;
}
