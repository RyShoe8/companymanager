export const DEMO_ORG = 'Meridian Studio';

export type DemoProject = {
  id: string;
  name: string;
  color: string;
  status: string;
  progress: number;
};

export type DemoEmployee = {
  id: string;
  name: string;
  initials: string;
  role: 'Administrator' | 'Manager' | 'User';
  employeeType: 'full-time' | 'part-time' | 'contractor';
  weeklyHours: number;
  capacity: number;
  projects: string[];
};

export type DemoTask = {
  name: string;
  status: 'active' | 'completed' | 'in-review';
  assigneeInitials: string;
  hours: number;
  due: string;
};

export type DemoContentItem = {
  title: string;
  channel: string;
  status: 'planned' | 'in-progress' | 'published';
  date: string;
  assigneeInitials: string;
};

export type DemoMeeting = {
  title: string;
  day: string;
  time: string;
  color: string;
  project: string;
};

export const DEMO_PROJECTS: DemoProject[] = [
  { id: 'p1', name: 'Website Relaunch', color: '#00c2e0', status: 'In Development', progress: 68 },
  { id: 'p2', name: 'Mobile App Beta', color: '#7a22e0', status: 'In Review', progress: 45 },
  { id: 'p3', name: 'Q2 Content Push', color: '#007bff', status: 'Planning', progress: 22 },
];

export const DEMO_EMPLOYEES: DemoEmployee[] = [
  {
    id: 'e1',
    name: 'Alex Chen',
    initials: 'AC',
    role: 'Manager',
    employeeType: 'full-time',
    weeklyHours: 38,
    capacity: 40,
    projects: ['Website Relaunch', 'Mobile App Beta'],
  },
  {
    id: 'e2',
    name: 'Jordan Lee',
    initials: 'JL',
    role: 'User',
    employeeType: 'full-time',
    weeklyHours: 36,
    capacity: 40,
    projects: ['Website Relaunch', 'Q2 Content Push'],
  },
  {
    id: 'e3',
    name: 'Sam Rivera',
    initials: 'SR',
    role: 'User',
    employeeType: 'contractor',
    weeklyHours: 24,
    capacity: 30,
    projects: ['Mobile App Beta'],
  },
  {
    id: 'e4',
    name: 'Priya Patel',
    initials: 'PP',
    role: 'Administrator',
    employeeType: 'full-time',
    weeklyHours: 32,
    capacity: 40,
    projects: ['Q2 Content Push'],
  },
];

export const DEMO_TASKS: DemoTask[] = [
  { name: 'Design homepage hero', status: 'active', assigneeInitials: 'AC', hours: 8, due: 'Jun 12' },
  { name: 'Set up analytics', status: 'in-review', assigneeInitials: 'JL', hours: 4, due: 'Jun 10' },
  { name: 'Write launch blog post', status: 'completed', assigneeInitials: 'PP', hours: 6, due: 'Jun 8' },
  { name: 'API integration tests', status: 'active', assigneeInitials: 'SR', hours: 12, due: 'Jun 15' },
];

export const DEMO_CONTENT: DemoContentItem[] = [
  { title: 'Product launch announcement', channel: 'Blog', status: 'in-progress', date: 'Jun 14', assigneeInitials: 'PP' },
  { title: 'Feature highlight thread', channel: 'LinkedIn', status: 'planned', date: 'Jun 16', assigneeInitials: 'AC' },
  { title: 'Behind-the-scenes reel', channel: 'Instagram', status: 'planned', date: 'Jun 18', assigneeInitials: 'JL' },
  { title: 'June newsletter draft', channel: 'Newsletter', status: 'published', date: 'Jun 5', assigneeInitials: 'PP' },
];

export const DEMO_MEETINGS: DemoMeeting[] = [
  { title: 'Sprint Planning', day: 'Mon', time: '10:00 AM', color: '#00c2e0', project: 'Website Relaunch' },
  { title: 'Client Demo', day: 'Wed', time: '2:00 PM', color: '#7a22e0', project: 'Mobile App Beta' },
  { title: 'Content Review', day: 'Fri', time: '11:00 AM', color: '#007bff', project: 'Q2 Content Push' },
];

export const DEMO_SMART_BUTTONS = [
  { label: 'Hosting', color: 'primary' as const },
  { label: 'Analytics', color: 'secondary' as const },
  { label: 'Figma', color: 'accent' as const },
  { label: 'Docs', color: 'secondary' as const },
  { label: 'Billing', color: 'accent' as const },
  { label: 'GitHub', color: 'primary' as const },
];

export const DEMO_TECH_STACK = ['Next.js', 'Vercel', 'MongoDB', 'Stripe'];
export const DEMO_MARKETING_STACK = ['Google Analytics', 'Mailchimp', 'Buffer'];

export const CALENDAR_DAYS = ['Mon 9', 'Tue 10', 'Wed 11', 'Thu 12', 'Fri 13'];
