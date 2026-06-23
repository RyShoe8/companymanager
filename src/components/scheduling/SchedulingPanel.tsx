'use client';

import { useEffect, useState } from 'react';
import type { IMeeting } from '@/lib/models/Meeting';
import { IProject } from '@/lib/models/Project';
import { IClient } from '@/lib/models/Client';
import { IEmployee } from '@/lib/models/Employee';
import CreateMeetingModal, { type MeetingCreateSuccessInfo } from '@/components/scheduling/CreateMeetingModal';
import MeetingFormModal, { type MeetingFormMeeting } from '@/components/scheduling/MeetingFormModal';
import MeetingsCalendarView from '@/components/scheduling/MeetingsCalendarView';
import type { MeetingRow } from '@/components/scheduling/MeetingAgendaRow';
import { MEETING_POPUP_BLOCKED_MESSAGE } from '@/lib/scheduling/openMeetingPopout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import MultiLinkTargetPicker from '@/components/workspace/MultiLinkTargetPicker';
import type { TimeframeType } from '@/lib/utils/dateUtils';
import type { MeetingUpdateScope } from '@/components/scheduling/MeetingFormModal';
import {
  appendMeetingNotesMessage,
  parseMeetingNotesFeedback,
} from '@/lib/scheduling/meetingNotesFeedback';
interface SchedulingPanelProps {
  projects: IProject[];
  clients: IClient[];
  employees?: IEmployee[];
  currentUserEmployeeId?: string | null;
  currentUserId?: string | null;
  isManagerOrAdmin: boolean;
  meetings: IMeeting[];
  loadingMeetings?: boolean;
  meetingRefreshKey?: number;
  timeframe: TimeframeType;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onRefreshMeetings: () => void;
  schedulingTimeZone: string;
  teamFilter?: string;
  externalMessage?: string | null;
  onClearExternalMessage?: () => void;
  onSetMessage?: (message: string) => void;
}

function meetingRowToFormMeeting(row: MeetingRow): MeetingFormMeeting {
  return {
    _id: row._id,
    title: row.title,
    start: row.start,
    end: row.end,
    linkedProjectIds: row.linkedProjectIds,
    linkedClientIds: row.linkedClientIds,
    attendeeEmployeeIds: row.attendeeEmployeeIds,
    externalAttendeeEmails: row.externalAttendeeEmails,
    googleRecurringEventId: row.googleRecurringEventId,
    joinUrl: row.joinUrl,
    joinPlatform: row.joinPlatform,
    description: row.description,
  };
}

export default function SchedulingPanel({
  projects,
  clients,
  employees = [],
  currentUserEmployeeId,
  currentUserId,
  isManagerOrAdmin,
  meetings,
  loadingMeetings = false,
  meetingRefreshKey = 0,
  timeframe,
  currentDate,
  onDateChange,
  onRefreshMeetings,
  schedulingTimeZone,
  teamFilter = 'All Teams',
  externalMessage,
  onClearExternalMessage,
  onSetMessage,
}: SchedulingPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingFormMeeting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MeetingRow | null>(null);
  const [deleteScope, setDeleteScope] = useState<MeetingUpdateScope>('instance');
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);
  const [editClientIds, setEditClientIds] = useState<string[]>([]);

  const displayMessage = externalMessage ?? message;

  const setPanelMessage = (msg: string | null) => {
    setMessage(msg);
    if (msg) onSetMessage?.(msg);
  };

  useEffect(() => {
    if (meetingRefreshKey > 0) {
      setPanelMessage('Meeting created.');
    }
  }, [meetingRefreshKey, onSetMessage]);

  const handleSaveMeetingLinks = async (meetingId: string) => {
    const editingMeetingRow = meetings.find((m) => m._id.toString() === meetingId);
    const res = await fetch(`/api/scheduling/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkedProjectIds: editProjectIds,
        linkedClientIds: editClientIds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEditingId(null);
      onRefreshMeetings();
      const participants =
        typeof data.participantsUpdatedCount === 'number' ? data.participantsUpdatedCount : 1;
      const calendars =
        typeof data.calendarsPatchedCount === 'number' ? data.calendarsPatchedCount : 0;
      let msg = 'Meeting links updated.';
      if (editingMeetingRow?.googleRecurringEventId && participants > 1) {
        msg = `Links updated across ${participants} meeting records${calendars > 0 ? `; ${calendars} Google Calendar${calendars === 1 ? '' : 's'} updated with agenda` : ''}.`;
      } else if (participants > 1) {
        msg = `Links updated for ${participants} team members${calendars > 0 ? `; ${calendars} calendar${calendars === 1 ? '' : 's'} updated` : ' in Nucleas'}.`;
      } else if (calendars > 0) {
        msg = 'Meeting links updated; agenda refreshed in your Google Calendar.';
      }
      setPanelMessage(
        appendMeetingNotesMessage(msg, parseMeetingNotesFeedback(data))
      );
    } else {
      setPanelMessage(data.error || 'Failed to update meeting.');
    }
  };

  const toggleEditClient = (id: string) => {
    setEditClientIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleEditProject = (id: string) => {
    setEditProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleMeetingCreated = async (info?: MeetingCreateSuccessInfo) => {
    onRefreshMeetings();
    let msg = 'Meeting created.';
    if (info?.invitesSent && info.invitesSent > 0) {
      msg += ` ${info.invitesSent} calendar invite${info.invitesSent === 1 ? '' : 's'} sent.`;
    }
    if (info?.skippedAttendees?.length) {
      msg += ` ${info.skippedAttendees.length} could not be invited (missing email).`;
    }
    setPanelMessage(appendMeetingNotesMessage(msg, info?.meetingNotes));
  };

  const handleMeetingUpdated = (info?: MeetingCreateSuccessInfo) => {
    onRefreshMeetings();
    setPanelMessage(appendMeetingNotesMessage('Meeting updated.', info?.meetingNotes));
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const params = deleteTarget.googleRecurringEventId
        ? `?scope=${deleteScope}`
        : '';
      const res = await fetch(`/api/scheduling/meetings/${deleteTarget._id}${params}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDeleteTarget(null);
        onRefreshMeetings();
        const count = typeof data.deletedCount === 'number' ? data.deletedCount : 1;
        setPanelMessage(
          deleteScope === 'series' && count > 1
            ? `Deleted ${count} meetings in the series.`
            : 'Meeting deleted.'
        );
      } else {
        setPanelMessage(typeof data.error === 'string' ? data.error : 'Failed to delete meeting.');
      }
    } catch {
      setPanelMessage('Failed to delete meeting.');
    } finally {
      setDeleting(false);
    }
  };

  if (loadingMeetings) {
    return <div className="text-text-secondary py-12 text-center">Loading meetings…</div>;
  }

  return (
    <div className="space-y-4">
      {displayMessage && (
        <div className="rounded-lg border border-border bg-background-card px-4 py-2 text-sm text-text-primary flex items-center justify-between gap-2">
          <span>{displayMessage}</span>
          <button
            type="button"
            className="text-text-muted hover:text-text-primary text-xs shrink-0"
            onClick={() => {
              setMessage(null);
              onClearExternalMessage?.();
            }}
            aria-label="Dismiss message"
          >
            Dismiss
          </button>
        </div>
      )}

      <CreateMeetingModal
        isOpen={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        projects={projects}
        clients={clients}
        employees={employees}
        currentUserEmployeeId={currentUserEmployeeId}
        isManagerOrAdmin={isManagerOrAdmin}
        schedulingTimeZone={schedulingTimeZone}
        onSuccess={handleMeetingCreated}
      />

      <MeetingFormModal
        mode="edit"
        isOpen={!!editingMeeting}
        onClose={() => setEditingMeeting(null)}
        meeting={editingMeeting}
        projects={projects}
        clients={clients}
        employees={employees}
        currentUserEmployeeId={currentUserEmployeeId}
        isManagerOrAdmin={isManagerOrAdmin}
        schedulingTimeZone={schedulingTimeZone}
        onSuccess={handleMeetingUpdated}
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete meeting"
        maxWidth="sm"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-text-secondary">
            Delete &ldquo;{deleteTarget?.title}&rdquo;? This cannot be undone.
          </p>
          {deleteTarget?.googleRecurringEventId && (
            <div className="space-y-2 rounded-lg border border-border p-3 bg-background-card">
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="radio"
                  name="deleteScope"
                  checked={deleteScope === 'instance'}
                  onChange={() => setDeleteScope('instance')}
                />
                This occurrence only
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="radio"
                  name="deleteScope"
                  checked={deleteScope === 'series'}
                  onChange={() => setDeleteScope('series')}
                />
                Entire series
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleConfirmDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Link clients & projects"
        maxWidth="md"
      >
        <div className="p-6 space-y-4">
          {editingId && (
            <p className="text-sm text-text-secondary">
              {meetings.find((m) => m._id.toString() === editingId)?.title ?? 'Meeting'}
            </p>
          )}
          <MultiLinkTargetPicker
            clients={clients}
            projects={projects}
            selectedClientIds={editClientIds}
            selectedProjectIds={editProjectIds}
            onToggleClient={toggleEditClient}
            onToggleProject={toggleEditProject}
            currentUserEmployeeId={currentUserEmployeeId}
            isManagerOrAdmin={isManagerOrAdmin}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => editingId && void handleSaveMeetingLinks(editingId)}
            >
              Save links
            </Button>
          </div>
        </div>
      </Modal>

      <MeetingsCalendarView
        meetings={meetings}
        timeframe={timeframe}
        currentDate={currentDate}
        onDateChange={onDateChange}
        projects={projects}
        clients={clients}
        employees={employees}
        isManagerOrAdmin={isManagerOrAdmin}
        currentUserEmployeeId={currentUserEmployeeId}
        onStartEdit={(meetingId, linkedProjectIds, linkedClientIds) => {
          setEditingId(meetingId);
          setEditProjectIds(linkedProjectIds);
          setEditClientIds(linkedClientIds);
        }}
        onNewMeeting={() => setShowMeetingModal(true)}
        currentUserId={currentUserId}
        onEditMeeting={(row) => setEditingMeeting(meetingRowToFormMeeting(row))}
        onDeleteMeeting={(row) => {
          setDeleteTarget(row);
          setDeleteScope('instance');
        }}
        onPopoutBlocked={() => setPanelMessage(MEETING_POPUP_BLOCKED_MESSAGE)}
      />
    </div>
  );
}
