'use client';

import MeetingFormModal, {
  type MeetingCreateSuccessInfo,
  type MeetingFormMeeting,
} from '@/components/scheduling/MeetingFormModal';
import { IProject } from '@/lib/models/Project';
import { IClient } from '@/lib/models/Client';
import { IEmployee } from '@/lib/models/Employee';

export type { MeetingCreateSuccessInfo, MeetingFormMeeting };

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
