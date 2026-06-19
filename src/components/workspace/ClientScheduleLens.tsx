'use client';

import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType } from '@/lib/utils/dateUtils';
import ClientCalendarView from '@/components/workspace/ClientCalendarView';

interface ClientScheduleLensProps {
  clients: IClient[];
  allProjects: IProject[];
  contentItems: IContentItem[];
  showTasks: boolean;
  showContent: boolean;
  timeframe: TimeframeType;
  currentDate: Date;
  onClientClick: (client: IClient) => void;
  onProjectClick?: (client: IClient, project: IProject) => void;
  onTaskClick?: (project: IProject, taskIndex: number) => void;
  onContentItemClick?: (item: IContentItem) => void;
  onDateChange: (date: Date) => void;
  currentUserId?: string | null;
  itemSeenRefreshTrigger?: number;
}

export default function ClientScheduleLens(props: ClientScheduleLensProps) {
  return <ClientCalendarView {...props} />;
}
