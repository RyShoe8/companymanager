import { describe, expect, it } from 'vitest';
import { parseReviewerGate } from '@/lib/ide/parseReviewerGate';

describe('parseReviewerGate', () => {
  it('fails closed on plain Reviewer text without a structured gate', () => {
    const gate = parseReviewerGate('Here is how the rules system works…');
    expect(gate.status).toBe('needs_more');
    if (gate.status === 'needs_more') {
      expect(gate.reason).toBe('missing_gate_fence');
    }
  });

  it('fails closed on malformed or invalid JSON in nucleas-gate', () => {
    const malformed = [
      'Some answer text',
      '```nucleas-gate',
      '{ not valid json }',
      '```',
    ].join('\n');
    const gate = parseReviewerGate(malformed);
    expect(gate.status).toBe('needs_more');
    if (gate.status === 'needs_more') {
      expect(gate.reason).toBe('malformed_gate_json');
    }
  });

  it('fails closed on unknown or rejected status', () => {
    const unknown = [
      'Some answer text',
      '```nucleas-gate',
      '{"status":"pending"}',
      '```',
    ].join('\n');
    const gate = parseReviewerGate(unknown);
    expect(gate.status).toBe('needs_more');
  });

  it('parses needs_more with jobs', () => {
    const raw = [
      'Still missing history persistence.',
      '```nucleas-gate',
      '{"status":"needs_more","jobs":["read src/lib/ide/chatHistory.ts","quote appendIdeChatTurns"],"reason":"no history evidence"}',
      '```',
    ].join('\n');
    const gate = parseReviewerGate(raw);
    expect(gate.status).toBe('needs_more');
    if (gate.status === 'needs_more') {
      expect(gate.jobs).toEqual([
        'read src/lib/ide/chatHistory.ts',
        'quote appendIdeChatTurns',
      ]);
      expect(gate.reason).toBe('no history evidence');
    }
  });

  it('parses accept and strips the fence from the user answer', () => {
    const raw = [
      'Rules are loaded by loadIdeTaskRuleTexts and injected into the system prompt.',
      '```nucleas-gate',
      '{"status":"accept"}',
      '```',
    ].join('\n');
    const gate = parseReviewerGate(raw);
    expect(gate).toEqual({
      status: 'accept',
      answer: 'Rules are loaded by loadIdeTaskRuleTexts and injected into the system prompt.',
    });
  });
});
