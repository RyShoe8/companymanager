import 'server-only';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import Project from '@/lib/models/Project';
import { createGoogleDocLinkedAsset } from '@/lib/google/workspaceOperations';
import type { ShareWarning } from '@/lib/google/drive';

const MEETING_NOTES_DRIVE_NOTICE =
  'Connect Google Drive to auto-create meeting notes. Link Drive from any project’s Create menu (Document, Spreadsheet, or File).';

export const MEETING_NOTES_TAG = 'meeting-notes';

type MeetingNotesAssetSummary = {
  projectId: string;
  assetId: string;
  name: string;
};

export type MeetingNotesResult = {
  created: MeetingNotesAssetSummary[];
  shareWarnings: ShareWarning[];
  notice?: string;
};

export function buildMeetingNotesScopeTag(meeting: {
  _id: Types.ObjectId | string;
  googleRecurringEventId?: string | null;
}): string {
  if (meeting.googleRecurringEventId) {
    return `series:${meeting.googleRecurringEventId}`;
  }
  return `meeting:${meeting._id.toString()}`;
}

export function diffNewlyLinkedProjects(
  previous: Array<Types.ObjectId | string>,
  next: Array<Types.ObjectId | string>
): string[] {
  const prevSet = new Set(previous.map((id) => id.toString()));
  return next.map((id) => id.toString()).filter((id) => !prevSet.has(id));
}

function buildMeetingNotesDocName(projectName: string, meetingTitle: string): string {
  const project = projectName.trim() || 'Project';
  const title = meetingTitle.trim() || 'Meeting';
  return `${project} — ${title} notes`;
}

async function loadProjectNames(projectIds: string[]): Promise<Record<string, string>> {
  if (projectIds.length === 0) return {};
  await connectDB();
  const projects = await Project.find({ _id: { $in: projectIds } })
    .select('name')
    .lean();
  const map: Record<string, string> = {};
  for (const project of projects) {
    map[project._id.toString()] = project.name;
  }
  return map;
}

export async function ensureMeetingNotesDocsForProjects(params: {
  userId: string;
  meeting: {
    _id: Types.ObjectId | string;
    title: string;
    googleRecurringEventId?: string | null;
  };
  newlyLinkedProjectIds: string[];
}): Promise<MeetingNotesResult> {
  const { userId, meeting, newlyLinkedProjectIds } = params;
  const uniqueProjectIds = [...new Set(newlyLinkedProjectIds.filter((id) => Types.ObjectId.isValid(id)))];
  if (uniqueProjectIds.length === 0) {
    return { created: [], shareWarnings: [] };
  }

  await connectDB();

  const projectNamesById = await loadProjectNames(uniqueProjectIds);
  const scopeTag = buildMeetingNotesScopeTag(meeting);
  const session = { userId };
  const created: MeetingNotesAssetSummary[] = [];
  const shareWarnings: ShareWarning[] = [];
  let notice: string | undefined;
  let sawNoDrive = false;

  for (const projectId of uniqueProjectIds) {
    const existing = await Asset.findOne({
      linkedProjectId: new Types.ObjectId(projectId),
      type: 'document',
      tags: { $all: [MEETING_NOTES_TAG, scopeTag] },
    })
      .select('_id name')
      .lean();

    if (existing) continue;

    const projectName = projectNamesById[projectId] ?? 'Project';
    const docName = buildMeetingNotesDocName(projectName, meeting.title);
    const result = await createGoogleDocLinkedAsset(
      session,
      docName,
      { linkedProjectId: projectId },
      [MEETING_NOTES_TAG, scopeTag]
    );

    if (!result.ok) {
      if (result.reason === 'no_drive') {
        sawNoDrive = true;
      } else {
        console.error('Meeting notes doc create failed:', result.error);
      }
      continue;
    }

    created.push({
      projectId,
      assetId: result.asset._id.toString(),
      name: result.asset.name,
    });
    shareWarnings.push(...result.shareWarnings);
  }

  if (sawNoDrive && created.length === 0) {
    notice = MEETING_NOTES_DRIVE_NOTICE;
  }

  return { created, shareWarnings, notice };
}
