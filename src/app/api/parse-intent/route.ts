import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth/middleware';

const MAX_INPUT_LEN = 4000;

const SYSTEM_PROMPT = `You are an intent parser for a productivity workspace app.

Return ONLY valid JSON (no markdown, no explanations).

The user message contains their spoken or typed command plus optional JSON "Context" (current screen). Use context to resolve omissions.

Schema keys:
- "action": one of "create_task" | "assign_task" | "assign_project" | "create_content" | "navigate" | "open_task" | "open_entity" | "complete_task" | "delete_entity" | "set_task_status" | "set_project_status" | "switch_lens" | "switch_view" | "filter_phase" | "set_timeframe" | "toggle_filter" | "update_project_description" | "run_command" | "unknown"
- "entity": "task" | "project" | "content" | "asset" | "navigation" | null
- "title": string | null — task/content/entity title
- "channel": string | null — for content use one of: X, LinkedIn, Email, Article, Instagram, TikTok, Video, Reddit, Bluesky, Other (map synonyms: tweet/post/twitter→X, blog/long-form→Article when confident)
- "date": string | null — MUST be ISO date YYYY-MM-DD when a calendar date applies (including phrases resolved against Context.referenceDate)
- "notes": string | null — extra context
- "projectId": string | null — Mongo/ObjectId string when known from utterance or from Context.projectId when user omits project but Context supplies one for task/content actions
- "project_name": string | null — human project name when spoken (alternative to projectId)
- "employee_name": string | null — assignee name for assign_task / assign_project
- "status": string | null — for set_task_status / set_project_status
- "context": string | null — disambiguation context such as project name for task operations
- "mode": string | null — for switch_view, values like calendar|agenda
- "lens": string | null — for switch_lens, values like schedule|projects|capacity
- "phase": string | null — for filter_phase, values like All|Plan|Build|Run
- "timeframe": string | null — for set_timeframe, values like today|weekly|monthly|quarterly|yearly
- "filter": string | null — for toggle_filter, values like tasks|content|myAssignments
- "toggle_action": string | null — for toggle_filter, values show|hide
- "entity_type": string | null — for open_entity/delete_entity, values project|content|asset|task
- "command_id": string | null — for run_command, direct command id when confident
- "navigation_target": string | null — where to go: workspace, assets, employees, admin, schedule, projects, capacity, calendar, agenda, plan, build, run

Rules:
- If the user does not name a project for create_task or create_content but Context.projectId is non-null, set projectId to Context.projectId (and optionally infer nothing else).
- If intent is assignment (assign, delegate, hand off, give task/project to someone), use assign_task / assign_project and never create_task.
- For assign_task, put the existing task title in "title" and the assignee in "employee_name". Use "project_name" or "projectId" only as context disambiguation.
- For assign_project, put project in "project_name" (or "projectId" when known) and assignee in "employee_name".
- Use create_task only for creating a new task (verbs like add/create/new task), not for assignment verbs.
- Prefer specific actions over generic ones when clear:
  - open task/project/content -> open_task/open_entity
  - complete task -> complete_task
  - set task/project status -> set_task_status/set_project_status
  - switch lens/view/phase/timeframe/filter -> switch_lens/switch_view/filter_phase/set_timeframe/toggle_filter
  - update project description -> update_project_description
- For toggle_filter, set both filter and toggle_action.
- Resolve relative dates (today, tomorrow, next Monday, etc.) using Context.referenceDate as "today" in YYYY-MM-DD in the user's local sense — output absolute date as date (YYYY-MM-DD).
- Use "unknown" if unsure.
- Use null for missing optional fields when truly absent after applying context rules.
- Do NOT invent project IDs not present in Context when user specifies a different project by name — prefer project_name in that case.`;

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  return fence ? fence[1].trim() : t;
}

function sanitizeContext(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const allowed = ['projectId', 'projectName', 'phase', 'view', 'referenceDate'] as const;
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    if (!(k in o)) continue;
    const v = o[k];
    if (k === 'view' && v && typeof v === 'object' && !Array.isArray(v)) {
      const view = v as Record<string, unknown>;
      const slim: Record<string, unknown> = {};
      if (typeof view.lens === 'string') slim.lens = view.lens.slice(0, 64);
      if (typeof view.scheduleMode === 'string') slim.scheduleMode = view.scheduleMode.slice(0, 64);
      if (typeof view.pathname === 'string') slim.pathname = view.pathname.slice(0, 512);
      out.view = slim;
    } else if (k === 'phase' && typeof v === 'string') {
      out.phase = v.slice(0, 64);
    } else if (k === 'referenceDate' && typeof v === 'string') {
      out.referenceDate = v.slice(0, 32);
    } else if ((k === 'projectId' || k === 'projectName') && typeof v === 'string') {
      out[k] = v.slice(0, 256);
    } else if ((k === 'projectId' || k === 'projectName') && v === null) {
      out[k] = null;
    }
  }
  const encoded = JSON.stringify(out);
  if (encoded.length > 12000) {
    return {
      phase: out.phase ?? null,
      referenceDate: out.referenceDate ?? null,
      truncated: true,
    };
  }
  return out;
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = typeof body === 'object' && body !== null && 'input' in body ? String((body as { input?: unknown }).input ?? '') : '';
  const trimmed = input.trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'input is required' }, { status: 400 });
  }
  if (trimmed.length > MAX_INPUT_LEN) {
    return NextResponse.json({ error: 'input too long' }, { status: 400 });
  }

  const rawContext =
    typeof body === 'object' && body !== null && 'context' in body ? (body as { context?: unknown }).context : undefined;
  const contextObj = sanitizeContext(rawContext);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Voice intent parsing not configured' }, { status: 503 });
  }

  const userContent =
    `User Input:\n${trimmed}\n\nContext:\n` + JSON.stringify(contextObj ?? {});

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: 'Empty model response' }, { status: 500 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFence(raw));
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from model', raw }, { status: 502 });
    }

    return NextResponse.json({ intent: parsed, raw });
  } catch (e) {
    console.error('[parse-intent]', e);
    return NextResponse.json({ error: 'Failed to parse intent' }, { status: 500 });
  }
}
