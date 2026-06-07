const MEETING_POPOUT_WINDOW_NAME = 'nucleas-meeting';

export type MeetingPopoutResult = {
  opened: boolean;
  blocked: boolean;
};

export function buildMeetingPopoutUrl(agendaToken: string): string {
  const path = `/scheduling/meeting/${encodeURIComponent(agendaToken)}?popout=1`;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

/**
 * Opens meeting detail in a pop-out window. Never navigates the main window.
 */
export function openMeetingPopout(agendaToken: string): MeetingPopoutResult {
  if (typeof window === 'undefined') return { opened: false, blocked: false };

  const url = buildMeetingPopoutUrl(agendaToken);
  const width = 960;
  const height = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'popup=yes',
    'menubar=no',
    'toolbar=no',
    'location=yes',
    'status=no',
    'scrollbars=yes',
    'noopener',
    'noreferrer',
  ].join(',');

  const popup = window.open(url, MEETING_POPOUT_WINDOW_NAME, features);
  if (!popup) {
    return { opened: false, blocked: true };
  }

  try {
    popup.focus();
  } catch {
    /* ignore cross-origin focus errors */
  }

  return { opened: true, blocked: false };
}

export const MEETING_POPUP_BLOCKED_MESSAGE =
  'Allow pop-ups for this site to open the meeting window.';
