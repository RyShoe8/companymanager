import type { MeetingJoinPlatform } from '@/lib/scheduling/extractMeetingJoinUrl';

export type MeetingVideoMode = 'none' | 'google_meet' | 'manual';

export type NormalizedVideoConference = {
  videoMode: MeetingVideoMode;
  joinUrl?: string;
  joinPlatform?: MeetingJoinPlatform;
};

const URL_RE = /^https?:\/\/.+/i;

function detectPlatformFromUrl(url: string): MeetingJoinPlatform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('meet.google.com')) return 'google_meet';
    if (host.includes('zoom.us') || host.includes('zoom.com')) return 'zoom';
    if (host.includes('teams.microsoft.com')) return 'teams';
    if (host.includes('discord.gg') || host.includes('discord.com')) return 'discord';
  } catch {
    /* ignore */
  }
  return 'other';
}

export function normalizeVideoConferenceInput(
  videoModeRaw: unknown,
  joinUrlRaw: unknown
): { ok: true; value: NormalizedVideoConference } | { ok: false; error: string } {
  const videoMode: MeetingVideoMode =
    videoModeRaw === 'google_meet' || videoModeRaw === 'manual' || videoModeRaw === 'none'
      ? videoModeRaw
      : 'none';

  if (videoMode === 'manual') {
    const joinUrl = typeof joinUrlRaw === 'string' ? joinUrlRaw.trim() : '';
    if (!joinUrl) {
      return { ok: false, error: 'Enter a video conference link or choose another option.' };
    }
    if (!URL_RE.test(joinUrl)) {
      return { ok: false, error: 'Video link must start with http:// or https://.' };
    }
    return {
      ok: true,
      value: {
        videoMode,
        joinUrl,
        joinPlatform: detectPlatformFromUrl(joinUrl),
      },
    };
  }

  return { ok: true, value: { videoMode } };
}

export function inferVideoModeFromMeeting(meeting: {
  joinUrl?: string | null;
  joinPlatform?: MeetingJoinPlatform | null;
}): MeetingVideoMode {
  if (meeting.joinPlatform === 'google_meet' && meeting.joinUrl) {
    return 'google_meet';
  }
  if (meeting.joinUrl) {
    return 'manual';
  }
  return 'none';
}
