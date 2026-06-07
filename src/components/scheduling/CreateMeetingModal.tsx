'use client';

import MeetingFormModal, {
  type MeetingCreateSuccessInfo,
  type MeetingFormMeeting,
} from '@/components/scheduling/MeetingFormModal';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';

export type { MeetingCreateSuccessInfo, MeetingFormMeeting };

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: IProject[];
  employees: IEmployee[];
  currentUserEmployeeId?: string | null;
  schedulingTimeZone?: string;
  onSuccess?: (info?: MeetingCreateSuccessInfo) => void;
}

export default function CreateMeetingModal(props: CreateMeetingModalProps) {
  return <MeetingFormModal mode="create" {...props} />;
}
