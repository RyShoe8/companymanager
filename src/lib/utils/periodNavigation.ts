import { formatDate, getTimeframeRange, type TimeframeType } from '@/lib/utils/dateUtils';

export function getPeriodViewTitle(timeframe: TimeframeType, referenceDate: Date): string {
  const { start, end } = getTimeframeRange(timeframe, referenceDate);

  switch (timeframe) {
    case 'today': {
      const dayName = start.toLocaleDateString('en-US', { weekday: 'long' });
      const dateStr = start.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      return `${dayName}, ${dateStr}`;
    }
    case 'weekly':
      return `${formatDate(start)} - ${formatDate(end)}`;
    case 'monthly':
      return referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    case 'quarterly': {
      const quarter = Math.floor(referenceDate.getMonth() / 3) + 1;
      return `Q${quarter} ${referenceDate.getFullYear()}`;
    }
    case 'yearly':
      return referenceDate.getFullYear().toString();
    default:
      return referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
}

export function shiftPeriodDate(
  timeframe: TimeframeType,
  referenceDate: Date,
  direction: 'prev' | 'next'
): Date {
  const newDate = new Date(referenceDate);
  const delta = direction === 'prev' ? -1 : 1;

  switch (timeframe) {
    case 'today':
      newDate.setDate(newDate.getDate() + delta);
      break;
    case 'weekly':
      newDate.setDate(newDate.getDate() + delta * 7);
      break;
    case 'monthly':
      newDate.setMonth(newDate.getMonth() + delta);
      break;
    case 'quarterly':
      newDate.setMonth(newDate.getMonth() + delta * 3);
      break;
    case 'yearly':
      newDate.setFullYear(newDate.getFullYear() + delta);
      break;
  }

  return newDate;
}
