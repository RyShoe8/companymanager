export type {
  InsightVendorDto,
  InsightCategoryDto,
  InsightItemDto,
  InsightProgress,
  CategoryWithStatus,
} from '@/lib/insights/insightDto';

export {
  getInsightProgressForOwner,
  getInsightsForOwner,
  getInsightCategoriesWithStatusForOwner,
} from '@/lib/insights/getInsightsForOwner';

import {
  getInsightProgressForOwner,
  getInsightsForOwner,
  getInsightCategoriesWithStatusForOwner,
} from '@/lib/insights/getInsightsForOwner';

export async function getInsightProgress(projectId: string) {
  return getInsightProgressForOwner('project', projectId);
}

export async function getInsightsForProject(projectId: string, limit = 3) {
  return getInsightsForOwner('project', projectId, limit);
}

export async function getInsightCategoriesWithStatus(projectId: string) {
  return getInsightCategoriesWithStatusForOwner('project', projectId);
}
