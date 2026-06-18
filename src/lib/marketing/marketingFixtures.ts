import { Types } from 'mongoose';
import type { IAsset } from '@/lib/models/Asset';
import type { IClient } from '@/lib/models/Client';
import type { IContentItem, ContentChannel, ContentStatus, DistributionMethod } from '@/lib/models/ContentItem';
import type { IEmployee } from '@/lib/models/Employee';
import type { IMeeting } from '@/lib/models/Meeting';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import { toContentInputDate } from '@/components/planning-map/contentItemFormConstants';
import {
  buildMeetingDetailPayload,
  type MeetingDetailPayload,
} from '@/lib/scheduling/buildMeetingDetailPayload';
import { getProjectsForStage, type ProjectStage } from '@/lib/utils/statusMapping';

export const MARKETING_ORG_NAME = 'Meridian Studio';

/** Fixed Wednesday in June 2026 — keeps calendar/meeting fixtures visible. */
export const MARKETING_REFERENCE_DATE = new Date(Date.UTC(2026, 5, 10, 12, 0, 0));

const USER_ID = new Types.ObjectId('674a00000000000000000001');
const ORG_ID = 'marketing-demo-org';

export const MARKETING_PROJECT_IDS = {
  relaunch: new Types.ObjectId('674a00000000000000000101'),
  mobile: new Types.ObjectId('674a00000000000000000102'),
  contentPush: new Types.ObjectId('674a00000000000000000103'),
  northwindHub: new Types.ObjectId('674a00000000000000000104'),
  northwindPortal: new Types.ObjectId('674a00000000000000000105'),
  summitHub: new Types.ObjectId('674a00000000000000000106'),
} as const;

export const MARKETING_CLIENT_IDS = {
  northwind: new Types.ObjectId('674a00000000000000000601'),
  summit: new Types.ObjectId('674a00000000000000000602'),
} as const;

export const MARKETING_EMPLOYEE_IDS = {
  alex: new Types.ObjectId('674a00000000000000000201'),
  jordan: new Types.ObjectId('674a00000000000000000202'),
  sam: new Types.ObjectId('674a00000000000000000203'),
  priya: new Types.ObjectId('674a00000000000000000204'),
} as const;

function utcDay(year: number, month: number, day: number, hour = 12): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
}

function task(
  name: string,
  opts: Partial<IProjectTask> & { startDay?: number; endDay?: number; assigneeId?: Types.ObjectId }
): IProjectTask {
  const { startDay = 8, endDay = 12, assigneeId, ...rest } = opts;
  return {
    name,
    status: 'active',
    estimatedHours: 6,
    startDate: utcDay(2026, 6, startDay),
    endDate: utcDay(2026, 6, endDay),
    assignedToEmployeeIds: assigneeId ? [assigneeId] : [],
    assignedToEmployeeId: assigneeId,
    ...rest,
  };
}

const now = MARKETING_REFERENCE_DATE;

export const MARKETING_EMPLOYEES = [
  {
    _id: MARKETING_EMPLOYEE_IDS.alex,
    name: 'Alex Chen',
    role: 'Manager',
    jobTitle: 'Product Lead',
    team: 'Development',
    weeklyHours: 38,
    employeeType: 'full-time',
    organizationId: ORG_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_EMPLOYEE_IDS.jordan,
    name: 'Jordan Lee',
    role: 'User',
    jobTitle: 'Designer',
    team: 'Marketing',
    weeklyHours: 36,
    employeeType: 'full-time',
    organizationId: ORG_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_EMPLOYEE_IDS.sam,
    name: 'Sam Rivera',
    role: 'User',
    jobTitle: 'Engineer',
    team: 'Development',
    weeklyHours: 24,
    employeeType: 'contractor',
    organizationId: ORG_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_EMPLOYEE_IDS.priya,
    name: 'Priya Patel',
    role: 'Administrator',
    jobTitle: 'Operations',
    team: 'Marketing',
    weeklyHours: 32,
    employeeType: 'full-time',
    organizationId: ORG_ID,
    createdAt: now,
    updatedAt: now,
  },
] as unknown as IEmployee[];

export const MARKETING_PROJECTS = [
  {
    _id: MARKETING_PROJECT_IDS.relaunch,
    name: 'Website Relaunch',
    description: 'Redesign and ship the marketing site.',
    color: '#00c2e0',
    colorPalette: ['#00c2e0', '#7a22e0'],
    projectType: 'internal',
    category: 'website',
    status: 'in-development',
    devUrl: 'https://preview.meridian.studio',
    liveUrl: 'https://meridian.studio',
    techStack: [
      { category: 'framework', technologyId: 'nextjs' },
      { category: 'hosting', technologyId: 'vercel' },
      { category: 'database', technologyId: 'mongodb' },
    ],
    marketingStack: [
      { category: 'analytics', toolId: 'googleanalytics' },
      { category: 'email', toolId: 'mailchimp' },
    ],
    assignedToEmployeeIds: [MARKETING_EMPLOYEE_IDS.alex, MARKETING_EMPLOYEE_IDS.jordan],
    tasks: [
      task('Design homepage hero', { assigneeId: MARKETING_EMPLOYEE_IDS.jordan, startDay: 8, endDay: 10, status: 'active', estimatedHours: 8 }),
      task('Set up analytics', { assigneeId: MARKETING_EMPLOYEE_IDS.alex, startDay: 9, endDay: 11, status: 'in-review', estimatedHours: 4 }),
      task('Write launch blog post', { assigneeId: MARKETING_EMPLOYEE_IDS.priya, startDay: 5, endDay: 8, status: 'completed', estimatedHours: 6 }),
      task('API integration tests', { assigneeId: MARKETING_EMPLOYEE_IDS.sam, startDay: 10, endDay: 13, status: 'active', estimatedHours: 12 }),
    ],
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_PROJECT_IDS.mobile,
    name: 'Mobile App Beta',
    description: 'Beta release for iOS and Android.',
    color: '#7a22e0',
    projectType: 'client',
    category: 'app',
    status: 'in-review',
    clientId: MARKETING_CLIENT_IDS.northwind,
    techStack: [
      { category: 'framework', technologyId: 'react' },
      { category: 'payments', technologyId: 'stripe' },
    ],
    marketingStack: [{ category: 'social', toolId: 'buffer' }],
    socialLinks: [{ network: 'linkedin', url: 'https://linkedin.com/company/northwind-digital' }],
    assignedToEmployeeIds: [MARKETING_EMPLOYEE_IDS.sam],
    tasks: [
      task('TestFlight build', { assigneeId: MARKETING_EMPLOYEE_IDS.sam, startDay: 9, endDay: 12, estimatedHours: 10 }),
    ],
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_PROJECT_IDS.contentPush,
    name: 'Q2 Content Push',
    description: 'Cross-channel content for Q2 launch.',
    color: '#007bff',
    projectType: 'internal',
    category: 'generic',
    status: 'planning',
    marketingStack: [{ category: 'social', toolId: 'buffer' }],
    assignedToEmployeeIds: [MARKETING_EMPLOYEE_IDS.priya, MARKETING_EMPLOYEE_IDS.jordan],
    tasks: [
      task('Content calendar draft', { assigneeId: MARKETING_EMPLOYEE_IDS.priya, startDay: 8, endDay: 14, estimatedHours: 5 }),
    ],
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
] as unknown as IProject[];

export const MARKETING_CLIENT_PROJECTS = [
  {
    _id: MARKETING_PROJECT_IDS.northwindHub,
    name: 'Northwind Digital HQ',
    description: 'Client headquarters for general work.',
    color: '#0ea5e9',
    projectType: 'client-admin',
    category: 'generic',
    status: 'in-development',
    clientId: MARKETING_CLIENT_IDS.northwind,
    assignedToEmployeeIds: [MARKETING_EMPLOYEE_IDS.alex],
    tasks: [
      task('Monthly status email', { assigneeId: MARKETING_EMPLOYEE_IDS.priya, startDay: 8, endDay: 9, estimatedHours: 2 }),
      task('Review analytics dashboard', { assigneeId: MARKETING_EMPLOYEE_IDS.alex, startDay: 10, endDay: 11, status: 'active', estimatedHours: 3 }),
    ],
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_PROJECT_IDS.northwindPortal,
    name: 'Customer Portal',
    description: 'Self-service portal for Northwind clients.',
    color: '#0284c7',
    projectType: 'client',
    category: 'website',
    status: 'in-development',
    clientId: MARKETING_CLIENT_IDS.northwind,
    devUrl: 'https://portal.northwind.dev',
    techStack: [
      { category: 'framework', technologyId: 'nextjs' },
      { category: 'hosting', technologyId: 'vercel' },
    ],
    marketingStack: [{ category: 'analytics', toolId: 'googleanalytics' }],
    assignedToEmployeeIds: [MARKETING_EMPLOYEE_IDS.jordan, MARKETING_EMPLOYEE_IDS.sam],
    tasks: [
      task('Auth flow wireframes', { assigneeId: MARKETING_EMPLOYEE_IDS.jordan, startDay: 8, endDay: 10, estimatedHours: 6 }),
    ],
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_PROJECT_IDS.mobile,
    name: 'Mobile App Beta',
    description: 'Beta release for iOS and Android.',
    color: '#7a22e0',
    projectType: 'client',
    category: 'app',
    status: 'in-review',
    clientId: MARKETING_CLIENT_IDS.northwind,
    techStack: [
      { category: 'framework', technologyId: 'react' },
      { category: 'payments', technologyId: 'stripe' },
    ],
    marketingStack: [{ category: 'social', toolId: 'buffer' }],
    socialLinks: [{ network: 'linkedin', url: 'https://linkedin.com/company/northwind-digital' }],
    assignedToEmployeeIds: [MARKETING_EMPLOYEE_IDS.sam],
    tasks: [
      task('TestFlight build', { assigneeId: MARKETING_EMPLOYEE_IDS.sam, startDay: 9, endDay: 12, estimatedHours: 10 }),
    ],
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_PROJECT_IDS.summitHub,
    name: 'Summit Labs HQ',
    description: 'Client headquarters for Summit Labs.',
    color: '#10b981',
    projectType: 'client-admin',
    category: 'generic',
    status: 'planning',
    clientId: MARKETING_CLIENT_IDS.summit,
    assignedToEmployeeIds: [MARKETING_EMPLOYEE_IDS.priya],
    tasks: [
      task('Discovery kickoff', { assigneeId: MARKETING_EMPLOYEE_IDS.priya, startDay: 12, endDay: 14, estimatedHours: 4 }),
    ],
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
] as unknown as IProject[];

export const MARKETING_CLIENTS = [
  {
    _id: MARKETING_CLIENT_IDS.northwind,
    organizationId: USER_ID,
    userIds: [USER_ID],
    name: 'Northwind Digital',
    contactName: 'Morgan Ellis',
    contactEmail: 'morgan@northwind.digital',
    domain: 'northwind.digital',
    color: '#0ea5e9',
    status: 'active',
    socialLinks: [{ network: 'linkedin', url: 'https://linkedin.com/company/northwind-digital' }],
    techStack: [{ category: 'hosting', technologyId: 'vercel' }],
    marketingStack: [{ category: 'analytics', toolId: 'googleanalytics' }],
    actionButtons: [{ label: 'Client Drive', url: 'https://drive.google.com', kind: 'link' }],
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_CLIENT_IDS.summit,
    organizationId: USER_ID,
    userIds: [USER_ID],
    name: 'Summit Labs',
    contactName: 'Jamie Park',
    contactEmail: 'jamie@summitlabs.io',
    domain: 'summitlabs.io',
    color: '#10b981',
    status: 'lead',
    createdAt: now,
    updatedAt: now,
  },
] as unknown as IClient[];

export function marketingClientProjects(clientId: Types.ObjectId | string): IProject[] {
  const id = clientId.toString();
  return MARKETING_CLIENT_PROJECTS.filter((p) => p.clientId?.toString() === id) as IProject[];
}

export function marketingPrimaryClient(): IClient {
  return MARKETING_CLIENTS[0];
}

export const MARKETING_CONTENT_ITEMS = [
  {
    _id: new Types.ObjectId('674a00000000000000000301'),
    projectId: MARKETING_PROJECT_IDS.contentPush,
    title: 'Product launch announcement',
    channel: 'Article',
    status: 'in_progress',
    publishDate: utcDay(2026, 6, 12),
    assignedToEmployeeId: MARKETING_EMPLOYEE_IDS.priya,
    userId: USER_ID,
    distributionMethods: ['LinkedIn', 'Email'],
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: new Types.ObjectId('674a00000000000000000302'),
    projectId: MARKETING_PROJECT_IDS.relaunch,
    title: 'Feature highlight thread',
    channel: 'LinkedIn',
    status: 'planned',
    publishDate: utcDay(2026, 6, 11),
    assignedToEmployeeId: MARKETING_EMPLOYEE_IDS.alex,
    userId: USER_ID,
    distributionMethods: ['LinkedIn'],
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: new Types.ObjectId('674a00000000000000000303'),
    projectId: MARKETING_PROJECT_IDS.mobile,
    title: 'Behind-the-scenes reel',
    channel: 'Instagram',
    status: 'planned',
    publishDate: utcDay(2026, 6, 13),
    assignedToEmployeeId: MARKETING_EMPLOYEE_IDS.jordan,
    userId: USER_ID,
    distributionMethods: ['Instagram'],
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: new Types.ObjectId('674a00000000000000000304'),
    projectId: MARKETING_PROJECT_IDS.contentPush,
    title: 'June newsletter draft',
    channel: 'Email',
    status: 'published',
    publishDate: utcDay(2026, 6, 5),
    assignedToEmployeeId: MARKETING_EMPLOYEE_IDS.priya,
    userId: USER_ID,
    distributionMethods: ['Email'],
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: new Types.ObjectId('674a00000000000000000305'),
    projectId: MARKETING_PROJECT_IDS.northwindHub,
    title: 'Q2 client newsletter',
    channel: 'Email',
    status: 'planned',
    publishDate: utcDay(2026, 6, 14),
    assignedToEmployeeId: MARKETING_EMPLOYEE_IDS.priya,
    userId: USER_ID,
    distributionMethods: ['Email'],
    createdAt: now,
    updatedAt: now,
  },
] as unknown as IContentItem[];

export const MARKETING_MEETINGS = [
  {
    _id: new Types.ObjectId('674a00000000000000000401'),
    userId: USER_ID,
    organizationId: ORG_ID,
    title: 'Sprint Planning',
    start: utcDay(2026, 6, 8, 14),
    end: utcDay(2026, 6, 8, 15),
    agendaToken: 'agenda-sprint',
    linkedProjectIds: [MARKETING_PROJECT_IDS.relaunch],
    attendeeEmployeeIds: [MARKETING_EMPLOYEE_IDS.alex, MARKETING_EMPLOYEE_IDS.jordan],
    createdInNucleas: true,
    joinUrl: 'https://meet.google.com/demo-sprint',
    joinPlatform: 'google_meet',
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: new Types.ObjectId('674a00000000000000000402'),
    userId: USER_ID,
    organizationId: ORG_ID,
    title: 'Client Demo',
    start: utcDay(2026, 6, 10, 18),
    end: utcDay(2026, 6, 10, 19),
    agendaToken: 'agenda-demo',
    linkedProjectIds: [MARKETING_PROJECT_IDS.mobile],
    attendeeEmployeeIds: [MARKETING_EMPLOYEE_IDS.sam, MARKETING_EMPLOYEE_IDS.alex],
    createdInNucleas: true,
    joinUrl: 'https://meet.google.com/demo-client',
    joinPlatform: 'google_meet',
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: new Types.ObjectId('674a00000000000000000403'),
    userId: USER_ID,
    organizationId: ORG_ID,
    title: 'Content Review',
    start: utcDay(2026, 6, 12, 15),
    end: utcDay(2026, 6, 12, 16),
    agendaToken: 'agenda-content',
    linkedProjectIds: [MARKETING_PROJECT_IDS.contentPush],
    attendeeEmployeeIds: [MARKETING_EMPLOYEE_IDS.priya, MARKETING_EMPLOYEE_IDS.jordan],
    createdInNucleas: true,
    joinUrl: 'https://meet.google.com/demo-content',
    joinPlatform: 'google_meet',
    createdAt: now,
    updatedAt: now,
  },
] as unknown as IMeeting[];

export type MarketingSmartButton = {
  label: string;
  url: string;
  kind?: 'link' | 'email';
};

export const MARKETING_SMART_BUTTONS: MarketingSmartButton[] = [
  { label: 'Vercel', url: 'https://vercel.com' },
  { label: 'Analytics', url: 'https://analytics.google.com' },
  { label: 'Figma', url: 'https://figma.com' },
  { label: 'Docs', url: 'https://docs.google.com' },
  { label: 'Billing', url: 'https://stripe.com' },
  { label: 'GitHub', url: 'https://github.com' },
];

export function marketingProjectsForStage(stage: ProjectStage): IProject[] {
  return getProjectsForStage(MARKETING_PROJECTS, stage) as IProject[];
}

export function marketingActiveProjects(): IProject[] {
  return MARKETING_PROJECTS.filter((p) => p.status !== 'completed') as IProject[];
}

export const MARKETING_ASSET_IDS = {
  heroScreenshot: new Types.ObjectId('674a00000000000000000501'),
  walkthroughRecording: new Types.ObjectId('674a00000000000000000502'),
  brandGuide: new Types.ObjectId('674a00000000000000000503'),
  analyticsDashboard: new Types.ObjectId('674a00000000000000000504'),
  launchDeck: new Types.ObjectId('674a00000000000000000505'),
  homepageMockup: new Types.ObjectId('674a00000000000000000506'),
  apiSpec: new Types.ObjectId('674a00000000000000000507'),
  socialClip: new Types.ObjectId('674a00000000000000000508'),
} as const;

export const MARKETING_ASSETS = [
  {
    _id: MARKETING_ASSET_IDS.heroScreenshot,
    name: 'Homepage hero screenshot',
    type: 'screenshot',
    category: 'Marketing',
    linkedProjectId: MARKETING_PROJECT_IDS.relaunch,
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_ASSET_IDS.walkthroughRecording,
    name: 'Product walkthrough recording',
    type: 'file',
    category: 'Recordings',
    linkedProjectId: MARKETING_PROJECT_IDS.relaunch,
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_ASSET_IDS.brandGuide,
    name: 'Brand guidelines',
    type: 'document',
    category: 'Design',
    linkedProjectId: MARKETING_PROJECT_IDS.relaunch,
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_ASSET_IDS.analyticsDashboard,
    name: 'Analytics dashboard link',
    type: 'link',
    url: 'https://analytics.google.com',
    category: 'Analytics',
    linkedProjectId: MARKETING_PROJECT_IDS.relaunch,
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_ASSET_IDS.launchDeck,
    name: 'Launch deck',
    type: 'document',
    category: 'Sales',
    linkedProjectId: MARKETING_PROJECT_IDS.mobile,
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_ASSET_IDS.homepageMockup,
    name: 'Homepage mockup',
    type: 'screenshot',
    category: 'Design',
    linkedProjectId: MARKETING_PROJECT_IDS.relaunch,
    linkedContentItemId: MARKETING_CONTENT_ITEMS[1]._id,
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_ASSET_IDS.apiSpec,
    name: 'API integration spec',
    type: 'document',
    category: 'Engineering',
    linkedProjectId: MARKETING_PROJECT_IDS.relaunch,
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: MARKETING_ASSET_IDS.socialClip,
    name: 'Launch teaser clip',
    type: 'file',
    category: 'Social',
    linkedProjectId: MARKETING_PROJECT_IDS.contentPush,
    linkedContentItemId: MARKETING_CONTENT_ITEMS[0]._id,
    userId: USER_ID,
    createdAt: now,
    updatedAt: now,
  },
] as unknown as IAsset[];

export type MarketingContentDetailDefaults = {
  title: string;
  channel: ContentChannel;
  status: ContentStatus;
  publishDate: string;
  notes: string;
  assignedToEmployeeId: string;
  estimatedHours: string;
  keywords: string;
  internalLinks: string[];
  externalUrl: string;
  distributionMethods: DistributionMethod[];
  project: IProject;
};

export function marketingContentDetailDefaults(
  item: IContentItem = MARKETING_CONTENT_ITEMS[1]
): MarketingContentDetailDefaults {
  const project =
    MARKETING_PROJECTS.find((p) => p._id.toString() === item.projectId?.toString()) ??
    MARKETING_PROJECTS[0];
  return {
    title: item.title,
    channel: item.channel as ContentChannel,
    status: item.status as ContentStatus,
    publishDate: item.publishDate ? toContentInputDate(item.publishDate) : '',
    notes:
      'Thread announcing the homepage relaunch with feature highlights, customer proof points, and a CTA to book a demo.',
    assignedToEmployeeId: item.assignedToEmployeeId?.toString() ?? '',
    estimatedHours: '3',
    keywords: 'product launch, homepage, SaaS, relaunch',
    internalLinks: ['/features', '/pricing'],
    externalUrl: 'https://meridian.studio/blog/launch',
    distributionMethods: (item.distributionMethods ?? []) as DistributionMethod[],
    project,
  };
}

const marketingMeetingAssetsByProject = new Map<string, { _id: Types.ObjectId; name: string; type: string; linkedProjectId?: Types.ObjectId; linkedContentItemId?: Types.ObjectId }[]>([
  [
    MARKETING_PROJECT_IDS.relaunch.toString(),
    [
      {
        _id: MARKETING_ASSET_IDS.heroScreenshot,
        name: 'Homepage hero screenshot',
        type: 'screenshot',
        linkedProjectId: MARKETING_PROJECT_IDS.relaunch,
      },
      {
        _id: MARKETING_ASSET_IDS.brandGuide,
        name: 'Brand guidelines',
        type: 'document',
        linkedProjectId: MARKETING_PROJECT_IDS.relaunch,
      },
    ],
  ],
]);

const sprintMeeting = MARKETING_MEETINGS[0];

export const MARKETING_MEETING_DETAIL: MeetingDetailPayload = buildMeetingDetailPayload(
  {
    title: sprintMeeting.title,
    start: sprintMeeting.start,
    end: sprintMeeting.end,
    agendaUrl: `/scheduling/agenda/${sprintMeeting.agendaToken}`,
    joinUrl: sprintMeeting.joinUrl,
    joinPlatform: sprintMeeting.joinPlatform,
  },
  [MARKETING_PROJECTS[0]],
  marketingMeetingAssetsByProject,
  MARKETING_CONTENT_ITEMS.filter(
    (c) => c.projectId?.toString() === MARKETING_PROJECT_IDS.relaunch.toString()
  ),
  {
    employees: [
      { id: MARKETING_EMPLOYEE_IDS.alex.toString(), name: 'Alex Chen' },
      { id: MARKETING_EMPLOYEE_IDS.jordan.toString(), name: 'Jordan Lee' },
    ],
    externalEmails: [],
  }
);

export function marketingProjectName(projectId?: Types.ObjectId | string): string {
  if (!projectId) return '';
  const id = projectId.toString();
  return MARKETING_PROJECTS.find((p) => p._id.toString() === id)?.name ?? 'Project';
}

/** Static asset chip labels keyed by task name — for marketing previews only. */
export const MARKETING_TASK_ASSET_CHIPS: Record<string, string[]> = {
  'Design homepage hero': ['Homepage hero screenshot', 'Brand guidelines'],
  'API integration tests': ['API integration spec', 'Product walkthrough recording'],
};

export const MARKETING_LINKED_ASSET_EXAMPLES = [
  {
    label: 'Homepage hero screenshot',
    target: 'Website Relaunch · Design homepage hero',
    type: 'Task',
  },
  {
    label: 'Launch teaser clip',
    target: 'Q2 Content Push · Product launch announcement',
    type: 'Content',
  },
  {
    label: 'Brand guidelines',
    target: 'Website Relaunch',
    type: 'Project',
  },
] as const;
