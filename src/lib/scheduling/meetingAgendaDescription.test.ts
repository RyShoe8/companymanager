import { describe, expect, it } from 'vitest';
import { stripNucleasAgendaFromDescription } from '@/lib/scheduling/meetingAgendaDescription';

const sampleAgenda = `Meeting: Standup
When: 6/10/2026, 2:00:00 PM – 6/10/2026, 3:00:00 PM

Agenda:

• Test Project
  - Active task (active)

Open interactive agenda: https://example.com/scheduling/agenda/token123`;

describe('stripNucleasAgendaFromDescription', () => {
  it('returns empty string for empty input', () => {
    expect(stripNucleasAgendaFromDescription('')).toBe('');
    expect(stripNucleasAgendaFromDescription(undefined)).toBe('');
    expect(stripNucleasAgendaFromDescription(null)).toBe('');
  });

  it('returns user-only text unchanged', () => {
    expect(stripNucleasAgendaFromDescription('Discuss Q3 roadmap')).toBe('Discuss Q3 roadmap');
  });

  it('strips agenda block appended after user notes', () => {
    const full = `Discuss Q3 roadmap\n\n${sampleAgenda}`;
    expect(stripNucleasAgendaFromDescription(full)).toBe('Discuss Q3 roadmap');
  });

  it('returns empty string when description is agenda-only', () => {
    expect(stripNucleasAgendaFromDescription(sampleAgenda)).toBe('');
  });

  it('strips stacked duplicate agenda blocks, keeping user notes', () => {
    const duplicated = `My notes\n\n${sampleAgenda}\n\n${sampleAgenda}`;
    expect(stripNucleasAgendaFromDescription(duplicated)).toBe('My notes');
  });
});
