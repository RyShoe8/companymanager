import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EditableDate, { editableDateValue } from './EditableDate';
describe('inline date editing initial state', () => {
  it('renders the provided date immediately without an effect', () => {
    expect(renderToStaticMarkup(<EditableDate value="2026-09-10" startInEditMode onSave={() => {}} />)).toContain('value="2026-09-10"');
  });
  it('handles missing and invalid dates', () => {
    expect(editableDateValue(null, false)).toBe('');
    expect(editableDateValue('invalid', true)).toBe('');
  });
  it('preserves local time fields for datetime-local inputs', () => {
    expect(editableDateValue(new Date(2026, 8, 10, 9, 5), true)).toBe('2026-09-10T09:05');
  });
});
