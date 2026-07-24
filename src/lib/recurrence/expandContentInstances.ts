import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import {
  expandExtensionDates,
  expandInitialSeriesDates,
  newRecurrenceSeriesId,
} from '@/lib/recurrence/recurrenceHorizons';

export type ContentRecurrenceTemplate = {
  projectId: unknown;
  title: string;
  channel: string;
  status: string;
  notes?: string;
  assignedToEmployeeId?: unknown;
  userId: unknown;
  keywords?: string[];
  internalLinks?: string[];
  externalUrl?: string;
  distributionMethods?: string[];
  estimatedHours?: number;
};

function buildContentRowsForDates(
  template: ContentRecurrenceTemplate,
  publishDates: Date[],
  seriesId: string,
  preset: RecurrencePreset
): Record<string, unknown>[] {
  return publishDates.map((publishDate) => ({
    ...template,
    publishDate,
    recurrenceSeriesId: seriesId,
    recurrencePreset: preset,
  }));
}

export function expandInitialContentRows(
  template: ContentRecurrenceTemplate,
  anchorDate: Date,
  preset: RecurrencePreset
): Record<string, unknown>[] {
  const dates = expandInitialSeriesDates(anchorDate, preset);
  const seriesId = newRecurrenceSeriesId();
  return buildContentRowsForDates(template, dates, seriesId, preset);
}

export function expandExtensionContentRows(
  template: ContentRecurrenceTemplate,
  lastPublishDate: Date,
  preset: RecurrencePreset,
  unit: 'week' | 'month' | 'year',
  seriesId: string
): Record<string, unknown>[] {
  const dates = expandExtensionDates(lastPublishDate, preset, unit);
  return buildContentRowsForDates(template, dates, seriesId, preset);
}
