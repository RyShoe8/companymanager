import { describe, expect, it } from 'vitest';
import { ideChatSchema } from '@/lib/ide/ideChatSchema';
import { appendInteractionModePrompt, shouldForcePlainChat } from '@/lib/ide/planModePrompt';
import { parseNucleasPlan } from '@/lib/ide/parseNucleasPlan';
import { runSceneFromState } from '@/lib/ide/runScenePhases';

describe('ide plan mode helpers', () => {
  it('accepts interactionMode on the IDE chat schema', () => {
    const parsed = ideChatSchema.parse({
      mode: 'direct',
      text: 'hello',
      modelProfileId: 'a'.repeat(24),
      model: 'o4-mini',
      interactionMode: 'plan',
    });
    expect(parsed.interactionMode).toBe('plan');
    expect(ideChatSchema.parse({ mode: 'engineering', text: 'hi' }).interactionMode).toBe('chat');
  });

  it('appends plan and build prompt instructions', () => {
    expect(appendInteractionModePrompt('Base.', 'chat')).toMatch(/repo_tree/);
    expect(appendInteractionModePrompt('Base.', 'plan')).toMatch(/Plan mode/);
    expect(appendInteractionModePrompt('Base.', 'plan')).toMatch(/nucleas-plan/);
    expect(appendInteractionModePrompt('Base.', 'plan')).toMatch(/repo_read/);
    expect(appendInteractionModePrompt('Base.', 'build')).toMatch(/approved the plan/);
    expect(shouldForcePlainChat('plan')).toBe(false);
    expect(shouldForcePlainChat('chat')).toBe(false);
  });

  it('parses a nucleas-plan fence and strips it from display text', () => {
    const raw = [
      'Here is the approach.',
      '```nucleas-plan',
      JSON.stringify({
        title: 'Ship Plan mode',
        summary: 'Add Chat/Plan switch and center review.',
        steps: ['Toggle', 'Prompts', 'Approve'],
      }),
      '```',
      'Plan ready to review in the center pane.',
    ].join('\n');
    const parsed = parseNucleasPlan(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.plan.title).toBe('Ship Plan mode');
    expect(parsed!.plan.steps).toHaveLength(3);
    expect(parsed!.plan.status).toBe('ready_for_review');
    expect(parsed!.displayText).toMatch(/Plan ready/);
    expect(parsed!.displayText).not.toMatch(/nucleas-plan/);
  });

  it('returns null when the fence is missing', () => {
    expect(parseNucleasPlan('Just a chat reply.')).toBeNull();
  });

  it('maps run-scene phases without network', () => {
    expect(runSceneFromState({ busy: false, interactionMode: 'chat' }).label).toMatch(/Standing by|quiet/i);
    expect(
      runSceneFromState({ busy: true, interactionMode: 'plan', busyTick: 1 }).label
    ).toMatch(/Drafting plan/);
    expect(
      runSceneFromState({
        busy: false,
        interactionMode: 'plan',
        planReady: true,
      }).phase
    ).toBe('plan_ready');
  });
});
