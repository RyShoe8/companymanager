import type { GuideRole, GuideStep } from '@/lib/platformGuide/types';

export function filterStepsForRole(steps: GuideStep[], role?: GuideRole): GuideStep[] {
  return steps.filter((step) => {
    if (!step.roles || step.roles.length === 0) return true;
    if (!role) return false;
    return step.roles.includes(role);
  });
}

export const PLATFORM_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Nucleas',
    body: 'This short guide walks through your workspace, how to add projects, tasks, and content, plus Assets and Team. Click OK to continue or End Guide anytime.',
    target: null,
    placement: 'center',
    routePrefix: '/workspace',
    onEnter: ({ router, workspaceActions }) => {
      router.push('/workspace?phase=Plan');
      workspaceActions?.setPhase('Plan');
      workspaceActions?.setLens('schedule');
      workspaceActions?.closeInspector();
      workspaceActions?.closeProjectForm();
      workspaceActions?.closeCreateMenu();
    },
  },
  {
    id: 'org-brand',
    title: 'Your organization',
    body: 'Your company name and logo appear here. Admins can click the name to edit it and upload their logo.',
    target: 'org-brand',
    placement: 'bottom',
    routePrefix: '/workspace',
  },
  {
    id: 'phase-filter',
    title: 'Project phases',
    body: 'Filter work by lifecycle: Plan, Build, Run, or open Schedule for meetings and availability.',
    target: 'phase-filter',
    placement: 'bottom',
    routePrefix: '/workspace',
  },
  {
    id: 'time-horizon',
    title: 'Time horizon',
    body: 'Switch between Today, Weekly, Monthly, Quarterly, and Yearly views to plan at the right scale.',
    target: 'time-horizon',
    placement: 'bottom',
    routePrefix: '/workspace',
  },
  {
    id: 'lens-bar',
    title: 'View lens',
    body: 'Projects shows your calendar schedule, Agenda lists work by day, and Capacity shows team utilization.',
    target: 'lens-bar',
    placement: 'bottom',
    routePrefix: '/workspace',
    onEnter: ({ workspaceActions }) => {
      workspaceActions?.setLens('schedule');
    },
  },
  {
    id: 'lens-toggles',
    title: 'Calendar display',
    body: 'Toggle tasks, content, and meetings on the calendar to control how much detail you see.',
    target: 'lens-toggles',
    placement: 'left',
    routePrefix: '/workspace',
    onEnter: ({ workspaceActions }) => {
      workspaceActions?.setLens('schedule');
    },
  },
  {
    id: 'create-menu',
    title: 'Create menu',
    body: 'Everything new starts here — projects, tasks, content, meetings, screenshots, and recordings. Shortcut: press C.',
    target: 'create-menu',
    placement: 'bottom',
    routePrefix: '/workspace',
    onExit: ({ workspaceActions }) => {
      workspaceActions?.closeCreateMenu();
    },
  },
  {
    id: 'create-project',
    title: 'Create a project',
    body: 'Projects are containers for tasks and content. Add a name, dates, and team members to get started.',
    target: 'create-menu',
    placement: 'bottom',
    roles: ['Administrator', 'Manager'],
    routePrefix: '/workspace',
    onEnter: ({ workspaceActions }) => {
      workspaceActions?.openCreateMenu();
    },
    onExit: ({ workspaceActions }) => {
      workspaceActions?.closeCreateMenu();
    },
  },
  {
    id: 'project-form',
    title: 'Project details',
    body: 'Fill in the project name and timeline, then save when ready. You can always edit later from the project inspector.',
    target: 'quick-project-form',
    placement: 'right',
    roles: ['Administrator', 'Manager'],
    routePrefix: '/workspace',
    onEnter: ({ workspaceActions }) => {
      workspaceActions?.openProjectForm();
    },
    onExit: ({ workspaceActions }) => {
      workspaceActions?.closeProjectForm();
    },
  },
  {
    id: 'create-task',
    title: 'Add tasks',
    body: 'Choose Task from Create, pick a project, then add tasks in the project inspector with hours and assignments.',
    target: 'create-menu',
    placement: 'bottom',
    routePrefix: '/workspace',
    onEnter: ({ workspaceActions }) => {
      workspaceActions?.closeProjectForm();
      workspaceActions?.openCreateMenu();
    },
    onExit: ({ workspaceActions }) => {
      workspaceActions?.closeCreateMenu();
    },
  },
  {
    id: 'create-content',
    title: 'Plan content',
    body: 'Content items are scheduled posts, emails, and campaigns. Create from the menu and assign them to projects and dates.',
    target: 'create-menu',
    placement: 'bottom',
    routePrefix: '/workspace',
    onEnter: ({ workspaceActions }) => {
      workspaceActions?.openCreateMenu();
    },
    onExit: ({ workspaceActions }) => {
      workspaceActions?.closeCreateMenu();
    },
  },
  {
    id: 'schedule-main',
    title: 'Schedule grid',
    body: 'Project cards appear on the calendar by date. Click a project to open the inspector for tasks, content, and assets.',
    target: 'schedule-main',
    placement: 'top',
    routePrefix: '/workspace',
    onEnter: ({ workspaceActions }) => {
      workspaceActions?.closeCreateMenu();
      workspaceActions?.closeProjectForm();
      workspaceActions?.setPhase('Plan');
      workspaceActions?.setLens('schedule');
    },
  },
  {
    id: 'project-inspector',
    title: 'Project inspector',
    body: 'The inspector is your command center for a project — edit tasks, content, comments, and linked assets in one place.',
    target: 'project-inspector',
    placement: 'left',
    routePrefix: '/workspace',
    skipIfTargetMissing: true,
    onEnter: ({ workspaceActions }) => {
      workspaceActions?.openFirstProjectInspector();
    },
    onExit: ({ workspaceActions }) => {
      workspaceActions?.closeInspector();
    },
  },
  {
    id: 'employee-sidebar',
    title: 'Team capacity',
    body: 'The sidebar shows utilization across your team so you can spot overload and balance workload.',
    target: 'employee-sidebar',
    placement: 'left',
    routePrefix: '/workspace',
    onExit: ({ workspaceActions }) => {
      workspaceActions?.closeInspector();
    },
  },
  {
    id: 'schedule-phase',
    title: 'Meetings & scheduling',
    body: 'Open the Schedule phase to connect your calendar, set availability, and book meetings with clients.',
    target: 'phase-filter',
    placement: 'bottom',
    routePrefix: '/workspace',
    onEnter: ({ workspaceActions }) => {
      workspaceActions?.setPhase('Schedule');
    },
    onExit: ({ workspaceActions }) => {
      workspaceActions?.setPhase('Plan');
    },
  },
  {
    id: 'feedback',
    title: 'Feedback',
    body: 'Report bugs or request features anytime — we read every submission.',
    target: 'feedback-button',
    placement: 'left',
    routePrefix: '/workspace',
  },
  {
    id: 'nav-assets',
    title: 'Assets library',
    body: 'Next, we will visit Assets — where screenshots, recordings, and files are stored and linked to projects.',
    target: 'nav-assets',
    placement: 'bottom',
    routePrefix: '/workspace',
    onEnter: ({ router }) => {
      router.push('/assets');
    },
  },
  {
    id: 'assets-upload',
    title: 'Upload assets',
    body: 'Upload files or capture screenshots and recordings from the workspace. Search and filter to find anything fast.',
    target: 'assets-upload',
    placement: 'bottom',
    routePrefix: '/assets',
    onEnter: ({ router }) => {
      router.push('/assets');
    },
  },
  {
    id: 'assets-grid',
    title: 'Asset library',
    body: 'Assets can be linked to projects and tasks so your team always has context where work happens.',
    target: 'assets-grid',
    placement: 'top',
    routePrefix: '/assets',
    skipIfTargetMissing: true,
  },
  {
    id: 'nav-team',
    title: 'Team management',
    body: 'Team is where you invite colleagues, assign roles, and manage seats on your plan.',
    target: 'nav-team',
    placement: 'bottom',
    routePrefix: '/assets',
    onEnter: ({ router }) => {
      router.push('/employees');
    },
  },
  {
    id: 'team-invite',
    title: 'Invite teammates',
    body: 'Organization admins can add team members, set roles, and send email invitations.',
    target: 'team-invite',
    placement: 'bottom',
    roles: ['Administrator'],
    routePrefix: '/employees',
    onEnter: ({ router }) => {
      router.push('/employees');
    },
  },
  {
    id: 'team-list',
    title: 'Your team',
    body: 'Everyone in your organization appears here with their role, hours, and invite status.',
    target: 'team-list',
    placement: 'top',
    routePrefix: '/employees',
    skipIfTargetMissing: true,
    onEnter: ({ router }) => {
      router.push('/employees');
    },
  },
  {
    id: 'finish',
    title: "You're ready",
    body: 'You are set up to plan projects, schedule work, and collaborate with your team. Reopen this guide from the workspace toolbar anytime in your first 30 days.',
    target: null,
    placement: 'center',
    routePrefix: '/employees',
    onEnter: ({ router }) => {
      router.push('/workspace?phase=Plan');
    },
  },
  {
    id: 'join-community',
    title: 'Join the community',
    body: 'Stay in the loop on Discord, Bluesky, and Reddit — product updates, tips, and a place to ask questions.',
    target: null,
    placement: 'center',
    routePrefix: '/workspace',
    showCommunityLinks: true,
    onEnter: ({ router }) => {
      router.push('/workspace?phase=Plan');
    },
  },
];
