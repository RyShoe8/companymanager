import { Types } from 'mongoose';
import type { IContentItem } from '@/lib/models/ContentItem';
import type { IEmployee } from '@/lib/models/Employee';
import type { IMeeting } from '@/lib/models/Meeting';
import type { IProject, IProjectTask } from '@/lib/models/Project';
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
    techStack: [
      { category: 'framework', technologyId: 'react' },
      { category: 'payments', technologyId: 'stripe' },
    ],
    marketingStack: [{ category: 'social', toolId: 'buffer' }],
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
