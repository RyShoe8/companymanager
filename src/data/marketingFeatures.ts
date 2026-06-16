export type MarketingFeature = {
  title: string;
  description: string;
  icon: string;
};

export type FeatureCategory = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  href: string;
  icon: string;
  features: MarketingFeature[];
};

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'projects',
    title: 'Projects',
    tagline: 'Your business command center',
    description:
      'Every project lives in one place — with tasks, timelines, assets, team assignments, and smart tools to keep everything moving forward.',
    href: '/features/projects',
    icon: 'folder',
    features: [
      {
        title: 'Custom Project Colors',
        description:
          'Brand each project with its own color palette for instant visual recognition across your workspace.',
        icon: 'palette',
      },
      {
        title: 'Project Tasks',
        description:
          'Break work into actionable tasks with statuses, assignments, and deadlines — all scoped to the project.',
        icon: 'check-square',
      },
      {
        title: 'Time Estimation (AI)',
        description:
          'Let AI analyze your tasks and estimate hours so you can plan capacity and timelines with confidence.',
        icon: 'clock-ai',
      },
      {
        title: 'Team Assignments',
        description:
          'Assign team members to projects and tasks with role-based visibility and workload awareness.',
        icon: 'users',
      },
      {
        title: 'Status Tracking',
        description:
          'Track project progress through Plan, Build, and Run phases with real-time status indicators.',
        icon: 'activity',
      },
      {
        title: 'Timeline Management',
        description:
          'Set start dates, deadlines, and milestones to keep every project on schedule.',
        icon: 'calendar',
      },
      {
        title: 'Project Marketing Stack',
        description:
          'Document and quick-launch every marketing tool linked to a project — analytics, ads, email, and more.',
        icon: 'megaphone',
      },
      {
        title: 'Project Tech Stack',
        description:
          'Track hosting, frameworks, databases, and infrastructure for each project in one view.',
        icon: 'code',
      },
      {
        title: 'Project Social Links',
        description:
          'Centralize all social media profiles and links for each project for quick access.',
        icon: 'share',
      },
      {
        title: 'Project Logos',
        description:
          'Store and manage project logos and brand assets directly within the project workspace.',
        icon: 'image',
      },
      {
        title: 'Resource Planning',
        description:
          'Plan resource allocation across team members and projects to optimize throughput.',
        icon: 'bar-chart',
      },
      {
        title: 'Flexible Tasks',
        description:
          'Create tasks with custom fields, linked assets, recurrence, and nested breakdowns.',
        icon: 'layers',
      },
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks',
    tagline: 'Break it down, get it done',
    description:
      'Powerful task management with breakdowns, recurrence, linked assets, and AI-powered estimation — built for teams that ship.',
    href: '/features/tasks',
    icon: 'check-circle',
    features: [
      {
        title: 'Task Breakdown',
        description:
          'Split complex work into subtasks and checklists so nothing falls through the cracks.',
        icon: 'list',
      },
      {
        title: 'Task Status Tracking',
        description:
          'Move tasks through customizable statuses — to-do, in progress, review, done — with visual indicators.',
        icon: 'activity',
      },
      {
        title: 'Task Recurrence',
        description:
          'Set tasks to repeat daily, weekly, or on custom schedules for recurring workflows.',
        icon: 'repeat',
      },
      {
        title: 'Task Linked Assets',
        description:
          'Attach screenshots, recordings, files, and links directly to tasks for full context.',
        icon: 'paperclip',
      },
      {
        title: 'Task Assignments',
        description:
          'Assign tasks to team members with due dates and priority levels.',
        icon: 'user-plus',
      },
      {
        title: 'Task Time Estimation',
        description:
          'Estimate hours per task manually or let AI suggest time based on scope and complexity.',
        icon: 'clock',
      },
      {
        title: 'Inline Task Management',
        description:
          'Create, edit, and complete tasks inline without leaving your current view.',
        icon: 'edit',
      },
    ],
  },
  {
    id: 'content',
    title: 'Content',
    tagline: 'Plan, create, distribute',
    description:
      'A complete content workflow — from ideation to scheduling to publishing — with channels, targeting, and asset management built in.',
    href: '/features/content',
    icon: 'file-text',
    features: [
      {
        title: 'Content Items',
        description:
          'Create and manage individual content pieces with rich metadata, status, and scheduling.',
        icon: 'file-plus',
      },
      {
        title: 'Content Targeting',
        description:
          'Define audiences, personas, and targeting criteria for each content item.',
        icon: 'target',
      },
      {
        title: 'Content Channels',
        description:
          'Organize content by distribution channel — blog, social, email, video, and more.',
        icon: 'send',
      },
      {
        title: 'Content Linked Assets',
        description:
          'Attach images, documents, and media files directly to content items for a complete brief.',
        icon: 'paperclip',
      },
      {
        title: 'Content Scheduling',
        description:
          'Schedule content across channels with calendar views and timeline management.',
        icon: 'calendar',
      },
      {
        title: 'Content Creation Modal',
        description:
          'Quickly create new content items with a streamlined modal — set channel, status, and details in seconds.',
        icon: 'plus-circle',
      },
      {
        title: 'Content Detail Modal',
        description:
          'Dive deep into any content item with a full detail view — assets, targeting, scheduling, and history.',
        icon: 'maximize',
      },
      {
        title: 'Content Item Assets Section',
        description:
          'Dedicated asset section within each content item to manage all associated media and files.',
        icon: 'image',
      },
      {
        title: 'Content Channel Filter',
        description:
          'Filter your content pipeline by channel to focus on what matters — blog, social, ads, or email.',
        icon: 'filter',
      },
    ],
  },
  {
    id: 'meetings',
    title: 'Meetings',
    tagline: 'Every meeting, fully prepared',
    description:
      'Smart meeting management with agendas, project context, and a focused popout — so every call has purpose and every minute counts.',
    href: '/features/meetings',
    icon: 'video',
    features: [
      {
        title: 'Meeting Creation',
        description:
          'Create meetings with agendas, attendees, and project links in a streamlined workflow.',
        icon: 'plus-circle',
      },
      {
        title: 'Meeting Agenda',
        description:
          'Build structured agendas with topics, time allocations, and linked discussion items.',
        icon: 'list',
      },
      {
        title: 'Meeting Project Insights',
        description:
          'Surface project status, recent tasks, and key metrics automatically before each meeting.',
        icon: 'bar-chart',
      },
      {
        title: 'Meeting Join Call',
        description:
          'Join video calls directly from the meeting view with one-click access to your conferencing tool.',
        icon: 'video',
      },
      {
        title: 'Meeting Detail View',
        description:
          'Full meeting popout with agenda, notes, attendees, and linked project work.',
        icon: 'maximize',
      },
      {
        title: 'Linked Project Work',
        description:
          'Review tasks and content tied to each linked project without leaving the meeting view.',
        icon: 'link',
      },
    ],
  },
  {
    id: 'scheduling',
    title: 'Scheduling',
    tagline: 'Plan meetings in your workspace',
    description:
      'Visual scheduling inside the Schedule phase — calendar, team availability, and linked projects in one view.',
    href: '/features/scheduling',
    icon: 'calendar',
    features: [
      {
        title: 'Workspace Calendar',
        description:
          'See meetings on a weekly calendar while you stay in the Nucleas workspace.',
        icon: 'calendar',
      },
      {
        title: 'Team Availability',
        description:
          'Capacity sidebar shows who is booked and who has room when you schedule.',
        icon: 'clock',
      },
      {
        title: 'Meeting Creation',
        description:
          'Create meetings with attendees, times, and project links from the Schedule phase.',
        icon: 'plus-circle',
      },
      {
        title: 'Linked Projects',
        description:
          'Attach projects when scheduling so meeting context is ready before the call.',
        icon: 'folder',
      },
      {
        title: 'Schedule Phase',
        description:
          'Dedicated Schedule phase keeps meeting planning separate from build and run work.',
        icon: 'layout',
      },
      {
        title: 'Agenda Handoff',
        description:
          'Open the meeting popout from scheduled events for insights and join links.',
        icon: 'maximize',
      },
    ],
  },
  {
    id: 'tools',
    title: 'Tools',
    tagline: 'Your built-in operating system',
    description:
      'Capture screenshots, record your screen, manage assets, and launch any tool with one click — all built into Nucleas.',
    href: '/features/tools',
    icon: 'tool',
    features: [
      {
        title: 'Screenshot Capture',
        description:
          'Capture full-page or area screenshots of any site directly from Nucleas — no extensions needed.',
        icon: 'camera',
      },
      {
        title: 'Screenshot Gallery',
        description:
          'Browse, search, and manage all captured screenshots in a visual gallery.',
        icon: 'grid',
      },
      {
        title: 'Recording Capture',
        description:
          'Record your screen or specific tabs to capture walkthroughs, bugs, and demos.',
        icon: 'video',
      },
      {
        title: 'Recording Management',
        description:
          'Organize, preview, and link recordings to projects and tasks for full traceability.',
        icon: 'film',
      },
      {
        title: 'Asset Linking',
        description:
          'Link any asset — screenshot, recording, file, or URL — to projects, tasks, and content.',
        icon: 'link',
      },
      {
        title: 'Smart Buttons',
        description:
          'One-click buttons to launch hosting, analytics, docs, design tools, and more — customized per project.',
        icon: 'zap',
      },
    ],
  },
  {
    id: 'team',
    title: 'Team',
    tagline: "Know your team's capacity",
    description:
      "See who's available, who's overloaded, and who's assigned to what — with roles, hours, and workload tracking built in.",
    href: '/features/team',
    icon: 'users',
    features: [
      {
        title: 'Capacity Tracking',
        description:
          'Monitor weekly hours and availability for every team member in real time.',
        icon: 'bar-chart',
      },
      {
        title: 'Workload Visibility',
        description:
          'See task and project load per person to prevent burnout and balance assignments.',
        icon: 'activity',
      },
      {
        title: 'Role Management',
        description:
          'Define roles — developer, designer, manager, admin — with permissions and visibility controls.',
        icon: 'shield',
      },
      {
        title: 'Assignment Tracking',
        description:
          'Track every assignment across projects and tasks with status and progress indicators.',
        icon: 'clipboard',
      },
      {
        title: 'Weekly Hours',
        description:
          'Set and track weekly hour targets per employee to manage capacity and billing.',
        icon: 'clock',
      },
      {
        title: 'Employee Types',
        description:
          'Categorize team members as full-time, part-time, contractor, or freelancer.',
        icon: 'user',
      },
      {
        title: 'Role-Based Access',
        description:
          'Control what each role can see and do — from read-only access to full admin control.',
        icon: 'lock',
      },
      {
        title: 'Workload Analysis',
        description:
          'Analyze workload distribution across teams and time periods to optimize resource allocation.',
        icon: 'pie-chart',
      },
      {
        title: 'Team Overview',
        description:
          'A single dashboard showing team composition, availability, and assignment status.',
        icon: 'layout',
      },
      {
        title: 'Employee Sidebar',
        description:
          'Quick-access sidebar with employee details, current assignments, and availability.',
        icon: 'sidebar',
      },
    ],
  },
  {
    id: 'efficiency',
    title: 'Efficiency & Organization',
    tagline: 'Work smarter, not harder',
    description:
      'Shortcuts, smart forms, centralized assets, and collaboration tools that remove friction from every workflow.',
    href: '/features/efficiency',
    icon: 'zap',
    features: [
      {
        title: 'Smart Buttons',
        description:
          'Customizable one-click buttons to launch tools, open links, and trigger workflows per project.',
        icon: 'zap',
      },
      {
        title: 'Quick Project Form',
        description:
          'Spin up a new project in seconds with a streamlined creation form.',
        icon: 'plus-square',
      },
      {
        title: 'Quick Content Creation',
        description:
          'Create content items on the fly with pre-filled defaults and smart suggestions.',
        icon: 'edit',
      },
      {
        title: 'Keyboard Shortcuts',
        description:
          'Navigate, create, and manage everything with keyboard shortcuts — built for power users.',
        icon: 'command',
      },
      {
        title: 'Phase Filtering',
        description:
          'Filter your workspace by Plan, Build, or Run phase to focus on what matters right now.',
        icon: 'filter',
      },
      {
        title: 'Lens Views',
        description:
          'Switch between different workspace views — grid, list, timeline — to match your workflow.',
        icon: 'eye',
      },
      {
        title: 'Organization Branding',
        description:
          'Customize your workspace with your organization\'s logo, colors, and identity.',
        icon: 'star',
      },
      {
        title: 'Multi-Project Management',
        description:
          'Manage dozens of projects simultaneously with cross-project visibility and batch operations.',
        icon: 'layers',
      },
      {
        title: 'Centralized Asset Repository',
        description:
          'One library for all screenshots, recordings, files, and links — searchable and linkable.',
        icon: 'database',
      },
      {
        title: 'Project & Task Links',
        description:
          'Link related projects and tasks together for cross-referencing and dependency tracking.',
        icon: 'link',
      },
      {
        title: 'Team Collaboration',
        description:
          'Work together with shared projects, assignments, and real-time visibility into team activity.',
        icon: 'users',
      },
      {
        title: 'Comments & Discussions',
        description:
          'Add comments to projects, tasks, and content items for async collaboration and decision-making.',
        icon: 'message-circle',
      },
      {
        title: 'Invitations',
        description:
          'Invite team members to your organization with role-based onboarding and access control.',
        icon: 'mail',
      },
    ],
  },
];
