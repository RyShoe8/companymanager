import { sendEmail } from '@/lib/services/email';
import type { DigestEventRow } from '@/lib/workspace/workspaceNotifications';
import { groupDigestRowsByProject } from '@/lib/workspace/workspaceNotifications';

const LOGO_URL = 'https://nucleas.app/images/nucleas-logo.png';

export function eventTypeLabel(eventType: DigestEventRow['eventType']): string {
  if (eventType.endsWith('_comment')) return 'Comment';
  if (eventType.endsWith('_new')) return 'New';
  return 'Update';
}

function entityKindLabel(kind: DigestEventRow['entityKind']): string {
  switch (kind) {
    case 'task':
      return 'Task';
    case 'content':
      return 'Content';
    case 'project':
      return 'Project';
    case 'client':
      return 'Client';
    default:
      return 'Item';
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendWorkspaceDigestEmail(options: {
  to: string;
  recipientName?: string | null;
  events: DigestEventRow[];
  baseUrl: string;
}): Promise<void> {
  const { to, recipientName, events } = options;
  const count = events.length;
  const greeting = recipientName?.trim() ? `Hi ${recipientName.trim()},` : 'Hi there,';
  const grouped = groupDigestRowsByProject(events);

  const projectSectionsHtml = [...grouped.entries()]
    .map(([projectId, rows]) => {
      const projectName = rows[0]?.projectName ?? 'Project';
      const projectHref = rows.find((r) => r.entityKind === 'project')?.href
        ?? `${options.baseUrl}/workspace?project=${encodeURIComponent(projectId)}`;

      const itemsHtml = rows
        .map((row) => {
          const badge = eventTypeLabel(row.eventType);
          const kind = entityKindLabel(row.entityKind);
          return `
            <li style="margin: 0 0 10px 0; padding: 0;">
              <a href="${escapeHtml(row.href)}" style="color: #347AF6; text-decoration: none; font-weight: 600;">
                ${escapeHtml(row.entityLabel)}
              </a>
              <span style="display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: #E8F0FE; color: #347AF6;">
                ${badge}
              </span>
              <span style="color: #5E677D; font-size: 13px; margin-left: 6px;">${kind} · ${escapeHtml(row.changeLabel)}</span>
            </li>`;
        })
        .join('');

      return `
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #202637;">
            <a href="${escapeHtml(projectHref)}" style="color: #202637; text-decoration: none;">${escapeHtml(projectName)}</a>
          </h2>
          <ul style="margin: 0; padding-left: 20px; color: #202637; font-size: 15px; line-height: 1.5;">
            ${itemsHtml}
          </ul>
        </div>`;
    })
    .join('');

  const subject = `You have ${count} workspace update${count === 1 ? '' : 's'} in Nucleas`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #202637; max-width: 640px; margin: 0 auto; padding: 24px; background: #f8fafc;">
      <div style="background: #ffffff; border: 1px solid #E1E5EE; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(32, 38, 55, 0.06);">
        <div style="padding: 28px 28px 20px; border-bottom: 1px solid #E1E5EE; background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);">
          <img src="${LOGO_URL}" alt="Nucleas" width="140" style="display: block; margin-bottom: 20px;" />
          <p style="margin: 0 0 8px 0; font-size: 16px; color: #202637;">${escapeHtml(greeting)}</p>
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #202637;">
            ${count} workspace update${count === 1 ? '' : 's'}
          </h1>
          <p style="margin: 10px 0 0 0; color: #5E677D; font-size: 15px;">
            Here is what changed across your assigned projects, tasks, content, and clients.
          </p>
        </div>
        <div style="padding: 28px;">
          ${projectSectionsHtml}
          <div style="margin-top: 28px; text-align: center;">
            <a href="${escapeHtml(options.baseUrl)}/workspace"
               style="background-color: #347AF6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 15px;">
              Open workspace
            </a>
          </div>
        </div>
        <div style="padding: 20px 28px; border-top: 1px solid #E1E5EE; background: #fafbfc;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            You are receiving this because of your workspace email notification settings in Nucleas.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textLines = [
    greeting,
    '',
    `You have ${count} workspace update${count === 1 ? '' : 's'} in Nucleas.`,
    '',
  ];

  for (const [, rows] of grouped) {
    const projectName = rows[0]?.projectName ?? 'Project';
    textLines.push(projectName);
    for (const row of rows) {
      textLines.push(
        `- [${eventTypeLabel(row.eventType)}] ${entityKindLabel(row.entityKind)}: ${row.entityLabel} (${row.changeLabel})`
      );
      textLines.push(`  ${row.href}`);
    }
    textLines.push('');
  }

  textLines.push(`Open workspace: ${options.baseUrl}/workspace`);

  await sendEmail({ to, subject, html, text: textLines.join('\n') });
}
