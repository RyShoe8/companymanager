'use client';

import MeetingFormModal, {
  type MeetingCreateSuccessInfo,
} from '@/components/scheduling/MeetingFormModal';
import { IProject } from '@/lib/models/Project';
import { IClient } from '@/lib/models/Client';
import { IEmployee } from '@/lib/models/Employee';

export type { MeetingCreateSuccessInfo };

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: IProject[];
  clients: IClient[];
  employees: IEmployee[];
  currentUserEmployeeId?: string | null;
  isManagerOrAdmin?: boolean;
  schedulingTimeZone?: string;
  onSuccess?: (info?: MeetingCreateSuccessInfo) => void;
}

export default function CreateMeetingModal(props: CreateMeetingModalProps) {
  return <MeetingFormModal mode="create" {...props} />;
}
