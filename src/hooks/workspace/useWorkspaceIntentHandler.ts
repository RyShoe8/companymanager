import { useCallback } from 'react';
import type { useRouter } from 'next/navigation';
import { IProject, TaskStatus } from '@/lib/models/Project';
import type { PhaseType, LensType, WorkspaceState } from '@/lib/hooks/useWorkspaceData';
import type { TimeframeType } from '@/lib/utils/dateUtils';
import { fetchEstimatedHoursBatch } from '@/lib/ai/clientEstimateHours';
import { ParsedIntent, splitBatchTaskTitles } from '@/lib/voice/IntentParser';
import { matchTaskInProjects } from '@/lib/voice/matchProjectTask';
import { isEmployeeOnProjectTeam } from '@/lib/utils/projectTeam';
import { matchEmployeeByVoiceName } from '@/lib/voice/employeeMatcher';
import CommandRegistry from '@/lib/commands/CommandRegistry';

interface UseWorkspaceIntentHandlerOptions {
  ws: WorkspaceState;
  router: ReturnType<typeof useRouter>;
  inspectorFocus: string | null;
  handleDeleteProject: (id: string) => Promise<void>;
  handlePhaseSelect: (p: PhaseType) => void;
  handleLensSelect: (lens: LensType) => void;
  handleViewProjectTask: (project: IProject, taskIndex: number) => void;
  handleViewProjectContent: (project: IProject, contentItemId: string) => void;
  setInspectorFocus: (focus: string | null) => void;
  setInspectorOpenTaskIndex: (index: number | null) => void;
  setInspectorInitialAddContentOpen: (open: boolean) => void;
  setInspectorAddContentDate: (date: Date | undefined) => void;
  setInspectorAddContentPrefill: (
    prefill: { title: string; channel: string; notes: string } | null
  ) => void;
  setAddContentProject: (project: IProject | null) => void;
  setAddContentDefaultDate: (date: Date | undefined) => void;
  setAddContentVoicePrefill: (
    prefill: { title: string; channel: string; notes: string } | null
  ) => void;
  setShowContentCreateModal: (open: boolean) => void;
}

/** Executes a parsed voice intent against workspace state (may return a Promise for async actions). */
export function useWorkspaceIntentHandler({
  ws,
  router,
  inspectorFocus,
  handleDeleteProject,
  handlePhaseSelect,
  handleLensSelect,
  handleViewProjectTask,
  handleViewProjectContent,
  setInspectorFocus,
  setInspectorOpenTaskIndex,
  setInspectorInitialAddContentOpen,
  setInspectorAddContentDate,
  setInspectorAddContentPrefill,
  setAddContentProject,
  setAddContentDefaultDate,
  setAddContentVoicePrefill,
  setShowContentCreateModal,
}: UseWorkspaceIntentHandlerOptions) {
  return useCallback(
    async (intent: ParsedIntent): Promise<{ success: boolean; message: string }> => {
      const normalize = (s: string) =>
        s.toLowerCase().replace(/\b(the|task|item|a|an)\b/g, '').replace(/\s+/g, ' ').trim();

      const mergePatchProject = async (projectId: string, body: Record<string, unknown>) => {
        try {
          const res = await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { ok: false as const, message: (data as { error?: string }).error || 'Update failed' };
          }
          const data = await res.json().catch(() => null);
          if (data && typeof data === 'object' && (data as IProject)._id) {
            ws.patchProjectInState(data as IProject);
          } else {
            await ws.loadData({ silent: true });
          }
          return { ok: true as const, message: 'Updated' };
        } catch {
          return { ok: false as const, message: 'Network error' };
        }
      };

      const findEmployeeByVoice = (spoken: string) => matchEmployeeByVoiceName(spoken, ws.employees);

      const describeEmployeeMismatch = (spoken: string) => {
        const outcome = findEmployeeByVoice(spoken);
        if (outcome.kind === 'exact' || outcome.kind === 'fuzzy') {
          return { employee: outcome.match.employee, error: null as string | null };
        }

        if (outcome.kind === 'ambiguous') {
          const options = outcome.candidates
            .slice(0, 2)
            .map((c) => c.employee.name)
            .join(' or ');
          return {
            employee: null,
            error: `Couldn’t confidently match "${spoken}". Did you mean ${options}?`,
          };
        }

        return {
          employee: null,
          error: `Couldn’t confidently match employee "${spoken}". Try full first and last name.`,
        };
      };

      const mapProjectStatus = (raw: string): IProject['status'] | null => {
        const s = raw.toLowerCase().trim();
        if (s.includes('plan')) return 'planning';
        if (s.includes('build') || s.includes('development')) return 'in-development';
        if (s.includes('launch') || s.includes('run')) return 'launched';
        if (s.includes('review')) return 'in-review';
        if (s.includes('complete') || s.includes('done') || s.includes('finished')) return 'completed';
        return null;
      };

      const mapTaskStatus = (raw: string): TaskStatus | null => {
        const s = raw.toLowerCase().trim();
        if (s.includes('review')) return 'in-review';
        if (s.includes('complete') || s.includes('done') || s.includes('finished')) return 'completed';
        if (s.includes('active')) return 'active';
        return null;
      };

      const sanitizeVoiceCreateTaskTitle = (raw: string) =>
        raw
          .replace(/^\s*(?:called|named)\s+/i, '')
          .replace(/\b(?:add|create)\s+(?:a\s+)?tasks?\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

      const sanitizeVoiceProjectSlot = (raw: string) =>
        raw
          .replace(/^\s*(?:called|named)\s+/i, '')
          .replace(/\s+/g, ' ')
          .trim();

      const resolveVoiceTaskProject = (cleanedProjectId: string, cleanedProjectName: string): IProject | null => {
        let target: IProject | null = null;
        if (cleanedProjectId) {
          target = ws.allProjects.find((p) => p._id.toString() === cleanedProjectId) ?? null;
        }
        if (!target && cleanedProjectName) {
          const searchName = normalize(cleanedProjectName);
          target =
            ws.allProjects.find((p) => {
              const pName = normalize(p.name);
              return pName.includes(searchName) || searchName.includes(pName);
            }) ?? null;
        }
        return target;
      };

      if (intent.type === 'NAVIGATE') {
        const place = intent.slots.place;
        if (place === 'workspace') {
          router.push('/workspace');
          return { success: true, message: 'Opening workspace' };
        }
        if (place === 'assets') {
          router.push('/assets');
          return { success: true, message: 'Opening assets' };
        }
        if (place === 'employees') {
          router.push('/employees');
          return { success: true, message: 'Opening employees' };
        }
        if (place === 'admin') {
          router.push('/admin');
          return { success: true, message: 'Opening admin' };
        }
      }
      if (intent.type === 'SWITCH_LENS') {
        const lens = intent.slots.lens;
        if (lens === 'schedule' || lens === 'projects') {
          handleLensSelect('schedule');
          return { success: true, message: 'Switched to projects view' };
        }
        if (lens === 'agenda') {
          handleLensSelect('agenda');
          return { success: true, message: 'Switched to agenda lens' };
        }
        if (lens === 'capacity') {
          handleLensSelect('capacity');
          return { success: true, message: 'Switched to capacity lens' };
        }
      }
      if (intent.type === 'FILTER_PHASE') {
        const phase = intent.slots.phase as PhaseType;
        if (['All', 'Plan', 'Build', 'Run', 'Schedule'].includes(phase)) {
          handlePhaseSelect(phase);
          return { success: true, message: `Filtered to ${phase} phase` };
        }
      }
      if (intent.type === 'SET_TIMEFRAME') {
        ws.setTimeframe(intent.slots.timeframe as TimeframeType);
        return { success: true, message: `Timeframe set to ${intent.slots.timeframe}` };
      }
      if (intent.type === 'SWITCH_VIEW') {
        if (intent.slots.mode === 'calendar') {
          handleLensSelect('schedule');
          return { success: true, message: 'Switched to projects view' };
        }
        if (intent.slots.mode === 'agenda') {
          handleLensSelect('agenda');
          return { success: true, message: 'Switched to agenda view' };
        }
      }
      if (intent.type === 'CREATE_CONTENT') {
        const { title, channel, date, notes, project_name, projectId } = intent.slots;
        const titleStr = title?.trim() ?? '';
        const channelStr = channel?.trim() ?? '';
        const notesStr = notes?.trim() ?? '';
        const dateStr = date?.trim();

        let project: IProject | null = null;
        const pid = projectId?.trim();
        if (pid) {
          project = ws.allProjects.find((p) => p._id.toString() === pid) ?? null;
        }
        const pname = project_name?.trim();
        if (!project && pname) {
          const searchName = normalize(pname);
          project =
            ws.allProjects.find((p) => {
              const pName = normalize(p.name);
              return pName.includes(searchName) || searchName.includes(pName);
            }) ?? null;
        }
        if (!project) {
          project = ws.filteredProjects[0] ?? ws.allProjects[0] ?? null;
        }
        if (!project) {
          return { success: false, message: 'No project available to attach content' };
        }

        let defaultDate = new Date();
        if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const d = new Date(`${dateStr}T12:00:00`);
          if (!isNaN(d.getTime())) defaultDate = d;
        }

        const prefill = { title: titleStr, channel: channelStr, notes: notesStr };
        const focusedProjectId = inspectorFocus?.startsWith('project:')
          ? inspectorFocus.split(':')[1]
          : null;
        if (focusedProjectId && focusedProjectId === project._id.toString()) {
          setInspectorInitialAddContentOpen(true);
          setInspectorAddContentDate(defaultDate);
          setInspectorAddContentPrefill(prefill);
          return { success: true, message: 'Opening content creation form' };
        }

        setAddContentProject(project);
        setAddContentDefaultDate(defaultDate);
        setAddContentVoicePrefill(prefill);
        setShowContentCreateModal(true);
        return { success: true, message: 'Opening content creation form' };
      }
      if (intent.type === 'TOGGLE_FILTER') {
        if (intent.slots.filter === 'myAssignments') {
          if (!ws.isManagerOrAdmin) return { success: false, message: 'You must be a manager to toggle assignments filter' };
          ws.setShowOnlyMyAssignments(intent.slots.action === 'show');
          return { success: true, message: `${intent.slots.action === 'show' ? 'Showing' : 'Hiding'} only your assignments` };
        }
        if (intent.slots.filter === 'tasks') {
          ws.setShowTasks(intent.slots.action === 'show');
          return { success: true, message: `${intent.slots.action === 'show' ? 'Showing' : 'Hiding'} tasks` };
        }
        if (intent.slots.filter === 'content') {
          ws.setShowContent(intent.slots.action === 'show');
          return { success: true, message: `${intent.slots.action === 'show' ? 'Showing' : 'Hiding'} content` };
        }
      }
      if (intent.type === 'UPDATE_PROJECT_DESCRIPTION') {
        const { name, description } = intent.slots;
        if (!description?.trim()) return { success: false, message: 'No description text provided' };
        const searchName = normalize(name);
        const target = ws.allProjects.find(p => {
          const pName = normalize(p.name);
          return pName.includes(searchName) || searchName.includes(pName);
        });
        if (!target) return { success: false, message: `Could not find project matching "${name}"` };
        try {
          const res = await fetch(`/api/projects/${target._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: description.trim() }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            return { success: false, message: (data as { error?: string }).error || 'Failed to update description' };
          }
          if (data && typeof data === 'object' && (data as IProject)._id) {
            ws.patchProjectInState(data as IProject);
          } else {
            await ws.loadData({ silent: true });
          }
          return { success: true, message: `Updated description for ${target.name}` };
        } catch {
          return { success: false, message: 'Failed to update description' };
        }
      }

      if (intent.type === 'OPEN_ENTITY') {
        const { entityType, name } = intent.slots;
        const searchName = normalize(name);
        if (entityType === 'project') {
          const target = ws.allProjects.find(p => {
            const pName = normalize(p.name);
            return pName.includes(searchName) || searchName.includes(pName);
          });
          if (target) {
            setInspectorOpenTaskIndex(null);
            setInspectorFocus(`project:${target._id}`);
            return { success: true, message: `Opening project: ${target.name}` };
          }
        } else if (entityType === 'content') {
          const target = ws.contentItems.find(c => {
            const cTitle = normalize(c.title);
            return cTitle.includes(searchName) || searchName.includes(cTitle);
          });
          if (target) {
            const projectId = target.projectId?.toString();
            if (!projectId) {
              return { success: false, message: `Content "${target.title}" is not linked to a project` };
            }
            const project = ws.allProjects.find((p) => p._id.toString() === projectId);
            if (!project) {
              return { success: false, message: `Could not find project for content "${target.title}"` };
            }
            handleViewProjectContent(project, target._id.toString());
            return { success: true, message: `Opening content: ${target.title}` };
          }
        }
        return { success: false, message: `Could not find ${entityType} matching "${name}"` };
      }
      if (intent.type === 'DELETE_ENTITY') {
        const { entityType, name } = intent.slots;
        const searchName = normalize(name);
        if (entityType === 'project') {
          const target = ws.allProjects.find(p => {
            const pName = normalize(p.name);
            return pName.includes(searchName) || searchName.includes(pName);
          });
          if (target) {
            handleDeleteProject(target._id.toString());
            return { success: true, message: `Deleted project: ${target.name}` };
          }
        }
        if (entityType === 'task') {
          const m = matchTaskInProjects(ws.allProjects, normalize, name, null, { allowCompleted: true });
          if (m) {
            const { project: p, taskIdx } = m;
            const nextTasks = (p.tasks || []).filter((_, i) => i !== taskIdx);
            const r = await mergePatchProject(p._id.toString(), { tasks: nextTasks });
            return r.ok
              ? { success: true, message: `Removed task from ${p.name}` }
              : { success: false, message: r.message };
          }
        }
        return { success: false, message: `Could not find ${entityType} matching "${name}" to delete` };
      }
      if (intent.type === 'COMPLETE_TASK') {
        const { name, context } = intent.slots;
        const searchName = name ? normalize(name) : '';
        const searchContext = context ? normalize(context) : null;

        if ((!searchName || searchName === 'project') && searchContext) {
          const project = ws.allProjects.find(p => {
            const pName = normalize(p.name);
            return pName.includes(searchContext) || searchContext.includes(pName) || (searchContext.length <= 2 && pName.startsWith(searchContext));
          });
          if (!project) return { success: false, message: `Could not find project matching "${context}"` };
          const updatedTasks = (project.tasks || []).map(t => ({ ...t, status: 'completed' as const }));
          const r = await mergePatchProject(project._id.toString(), { status: 'completed', tasks: updatedTasks });
          return r.ok
            ? { success: true, message: `Marked project "${project.name}" as complete.` }
            : { success: false, message: r.message };
        }

        const bestMatch = matchTaskInProjects(ws.allProjects, normalize, name, context, { allowCompleted: false });
        if (bestMatch) {
          const { project: mProject, taskIdx, score } = bestMatch;
          const task = mProject.tasks![taskIdx];
          const updatedTasks = [...(mProject.tasks || [])];
          updatedTasks[taskIdx] = { ...task, status: 'completed' };
          const r = await mergePatchProject(mProject._id.toString(), { tasks: updatedTasks });
          return r.ok
            ? { success: true, message: `Marked task "${task.name}" as complete (score ${Math.round(score)})` }
            : { success: false, message: r.message };
        }

        return { success: false, message: `Could not find task matching "${name}"${context ? ` for "${context}"` : ''}` };
      }

      if (intent.type === 'OPEN_TASK') {
        const { name, context } = intent.slots;
        const ctx = context?.trim() ? context : null;
        const m = matchTaskInProjects(ws.allProjects, normalize, name, ctx, { allowCompleted: true });
        if (m) {
          handleViewProjectTask(m.project, m.taskIdx);
          return { success: true, message: `Opening task "${m.project.tasks![m.taskIdx].name}"` };
        }
        return { success: false, message: `Could not find task matching "${name}"` };
      }

      if (intent.type === 'BATCH_ADD_TASKS') {
        if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can add tasks' };
        const { titlesJoined, projectName, projectId, employeeName } = intent.slots;
        const cleanedProjectName = sanitizeVoiceProjectSlot(projectName || '');
        const cleanedProjectId = projectId?.trim() ?? '';

        const target = resolveVoiceTaskProject(cleanedProjectId, cleanedProjectName);
        if (!target) {
          return { success: false, message: 'Could not resolve a project for these tasks.' };
        }

        const rawTitles = splitBatchTaskTitles(titlesJoined || '');
        const cleanedTitles = rawTitles
          .map((t) => sanitizeVoiceCreateTaskTitle(t))
          .filter(
            (t) =>
              t.length >= 3 &&
              !/\bproject\b/i.test(t) &&
              !/\bto\s+(?:the\s+)?project\b/i.test(t)
          );
        if (cleanedTitles.length === 0) {
          return { success: false, message: 'No valid task names heard.' };
        }

        let assignEmp: { _id: unknown; name: string } | null = null;
        if (employeeName?.trim()) {
          const employeeResolution = describeEmployeeMismatch(employeeName);
          if (!employeeResolution.employee) {
            return { success: false, message: employeeResolution.error || 'Could not find employee' };
          }
          assignEmp = employeeResolution.employee;
        }

        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const newTasksBase = cleanedTitles.map((name) => ({
          name,
          description: '',
          status: 'active' as TaskStatus,
          startDate: new Date(),
          endDate: new Date(Date.now() + weekMs),
          estimatedHours: 0,
          assignedTo: assignEmp?.name ?? '',
          ...(assignEmp ? { assignedToEmployeeId: assignEmp._id as never } : {}),
        }));

        const estimates = await fetchEstimatedHoursBatch(
          cleanedTitles.map((name) => ({
            kind: 'task' as const,
            title: name,
            projectName: target.name,
          }))
        );
        const newTasks = newTasksBase.map((task, i) => ({
          ...task,
          estimatedHours: estimates[i] ?? task.estimatedHours,
        }));

        const nextTasks = [...(target.tasks || []), ...newTasks];
        const r = await mergePatchProject(target._id.toString(), { tasks: nextTasks });
        if (!r.ok) return { success: false, message: r.message };
        const n = cleanedTitles.length;
        const assignHint = assignEmp ? ` Assigned to ${assignEmp.name}.` : '';
        return { success: true, message: `Added ${n} task${n === 1 ? '' : 's'} to ${target.name}.${assignHint}` };
      }

      if (intent.type === 'ADD_TASK') {
        if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can add tasks' };
        const { taskName, projectName, projectId } = intent.slots;

        const cleanedTaskName = sanitizeVoiceCreateTaskTitle(taskName || '');
        const cleanedProjectName = sanitizeVoiceProjectSlot(projectName || '');
        const cleanedProjectId = projectId?.trim() ?? '';

        const target = resolveVoiceTaskProject(cleanedProjectId, cleanedProjectName);
        if (!target) {
          return { success: false, message: 'Could not resolve a project for this task.' };
        }
        if (!cleanedTaskName || cleanedTaskName.length < 3) {
          return { success: false, message: 'I heard the project, but not a clean task name.' };
        }
        if (/\bproject\b/i.test(cleanedTaskName) || /\bto\s+(?:the\s+)?project\b/i.test(cleanedTaskName)) {
          return { success: false, message: 'Task name looked like command text. Please repeat the task title only.' };
        }
        const newTaskBase = {
          name: cleanedTaskName,
          description: '',
          status: 'active' as TaskStatus,
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          estimatedHours: 0,
          assignedTo: '',
        };
        const [estimatedHours] = await fetchEstimatedHoursBatch([
          { kind: 'task', title: cleanedTaskName, projectName: target.name },
        ]);
        const newTask = {
          ...newTaskBase,
          estimatedHours: estimatedHours ?? newTaskBase.estimatedHours,
        };
        const nextTasks = [...(target.tasks || []), newTask];
        const r = await mergePatchProject(target._id.toString(), { tasks: nextTasks });
        return r.ok
          ? { success: true, message: `Added task to ${target.name}` }
          : { success: false, message: r.message };
      }

      if (intent.type === 'RENAME_PROJECT') {
        if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can rename projects' };
        const { fromName, toName } = intent.slots;
        const searchName = normalize(fromName);
        const target = ws.allProjects.find(p => {
          const pName = normalize(p.name);
          return pName.includes(searchName) || searchName.includes(pName);
        });
        if (!target) return { success: false, message: `Could not find project "${fromName}"` };
        const r = await mergePatchProject(target._id.toString(), { name: toName.trim() });
        return r.ok ? { success: true, message: `Renamed project to "${toName.trim()}"` } : { success: false, message: r.message };
      }

      if (intent.type === 'RENAME_TASK') {
        if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can rename tasks' };
        const { fromName, toName, context } = intent.slots;
        const ctx = context?.trim() ? context : null;
        const m = matchTaskInProjects(ws.allProjects, normalize, fromName, ctx, { allowCompleted: true });
        if (!m) return { success: false, message: `Could not find task "${fromName}"` };
        const tasks = [...(m.project.tasks || [])];
        tasks[m.taskIdx] = { ...tasks[m.taskIdx], name: toName.trim() };
        const r = await mergePatchProject(m.project._id.toString(), { tasks });
        return r.ok ? { success: true, message: `Renamed task to "${toName.trim()}"` } : { success: false, message: r.message };
      }

      if (intent.type === 'SET_PROJECT_STATUS') {
        if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can change project status' };
        const { projectName, status } = intent.slots;
        const st = mapProjectStatus(status);
        if (!st) return { success: false, message: `Unknown status "${status}"` };
        const searchName = normalize(projectName);
        const target = ws.allProjects.find(p => {
          const pName = normalize(p.name);
          return pName.includes(searchName) || searchName.includes(pName);
        });
        if (!target) return { success: false, message: `Could not find project "${projectName}"` };
        const r = await mergePatchProject(target._id.toString(), { status: st });
        return r.ok ? { success: true, message: `Set ${target.name} to ${st}` } : { success: false, message: r.message };
      }

      if (intent.type === 'SET_TASK_STATUS') {
        if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can change task status' };
        const { taskName, status, context } = intent.slots;
        const st = mapTaskStatus(status);
        if (!st) return { success: false, message: `Unknown task status "${status}"` };
        const ctx = context?.trim() ? context : null;
        const m = matchTaskInProjects(ws.allProjects, normalize, taskName, ctx, { allowCompleted: true });
        if (!m) return { success: false, message: `Could not find task "${taskName}"` };
        const tasks = [...(m.project.tasks || [])];
        tasks[m.taskIdx] = { ...tasks[m.taskIdx], status: st };
        const r = await mergePatchProject(m.project._id.toString(), { tasks });
        return r.ok ? { success: true, message: `Updated task status to ${st}` } : { success: false, message: r.message };
      }

      if (intent.type === 'ASSIGN_PROJECT') {
        if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can assign projects' };
        const { projectName, employeeName } = intent.slots;
        const employeeResolution = describeEmployeeMismatch(employeeName);
        if (!employeeResolution.employee) {
          return { success: false, message: employeeResolution.error || 'Could not find employee' };
        }
        const emp = employeeResolution.employee;
        const searchName = normalize(projectName);
        const target = ws.allProjects.find(p => {
          const pName = normalize(p.name);
          return pName.includes(searchName) || searchName.includes(pName);
        });
        if (!target) return { success: false, message: `Could not find project "${projectName}"` };
        const existing = ((target as { assignedToEmployeeIds?: unknown[] }).assignedToEmployeeIds || []).map((id) =>
          typeof id === 'string' ? id : (id as { toString: () => string }).toString()
        );
        const idStr = emp._id.toString();
        const merged = existing.includes(idStr) ? existing : [...existing, idStr];
        const r = await mergePatchProject(target._id.toString(), { assignedToEmployeeIds: merged });
        return r.ok
          ? { success: true, message: `Assigned ${target.name} to ${emp.name}` }
          : { success: false, message: r.message };
      }

      if (intent.type === 'ASSIGN_TASK') {
        if (!ws.isManagerOrAdmin) return { success: false, message: 'Only managers can assign tasks' };
        const { taskName, employeeName, context } = intent.slots;
        const employeeResolution = describeEmployeeMismatch(employeeName);
        if (!employeeResolution.employee) {
          return { success: false, message: employeeResolution.error || 'Could not find employee' };
        }
        const emp = employeeResolution.employee;
        const ctx = context?.trim() ? context : null;
        const m = matchTaskInProjects(ws.allProjects, normalize, taskName, ctx, { allowCompleted: true });
        if (!m) return { success: false, message: `Could not find task "${taskName}"` };
        if (!isEmployeeOnProjectTeam(m.project, emp._id)) {
          return { success: false, message: `Add ${emp.name} to the project team first` };
        }
        const tasks = [...(m.project.tasks || [])];
        const task = tasks[m.taskIdx];
        const existingIds = ((task as { assignedToEmployeeIds?: unknown[] }).assignedToEmployeeIds || []).map((id) =>
          typeof id === 'string' ? id : (id as { toString: () => string }).toString()
        );
        const legacyId = (task as { assignedToEmployeeId?: { toString(): string } }).assignedToEmployeeId?.toString();
        const mergedIds = existingIds.length > 0 ? existingIds : legacyId ? [legacyId] : [];
        const idStr = emp._id.toString();
        const nextIds = mergedIds.includes(idStr) ? mergedIds : [...mergedIds, idStr];
        const names = nextIds
          .map((id) => ws.employees.find((e) => e._id.toString() === id)?.name)
          .filter(Boolean);
        tasks[m.taskIdx] = {
          ...task,
          assignedToEmployeeIds: nextIds as never,
          assignedToEmployeeId: nextIds[0] as never,
          assignedTo: names.join(', '),
        };
        const r = await mergePatchProject(m.project._id.toString(), { tasks });
        return r.ok ? { success: true, message: `Assigned task to ${emp.name}` } : { success: false, message: r.message };
      }

      if (intent.type === 'RUN_COMMAND') {
        const commandId = intent.slots.commandId?.trim();
        if (!commandId) return { success: false, message: 'No command specified' };
        const executed = CommandRegistry.execute(commandId);
        return executed
          ? { success: true, message: `Done` }
          : { success: false, message: `Command "${commandId}" not available or failed` };
      }

      return { success: false, message: `Voice action ${intent.type} not fully implemented yet` };
    },
    [
      ws,
      handleDeleteProject,
      router,
      handleViewProjectTask,
      handleViewProjectContent,
      handlePhaseSelect,
      handleLensSelect,
      inspectorFocus,
      setInspectorFocus,
      setInspectorOpenTaskIndex,
      setInspectorInitialAddContentOpen,
      setInspectorAddContentDate,
      setInspectorAddContentPrefill,
      setAddContentProject,
      setAddContentDefaultDate,
      setAddContentVoicePrefill,
      setShowContentCreateModal,
    ]
  );
}
