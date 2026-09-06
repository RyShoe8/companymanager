export type AttentionFilter = 'all' | 'review' | 'issues';
export type AttentionPage = {
  items: { id: string; projectId: string; projectName: string; role: string; status: string;
    revision: number; createdAt: string; failureCode: string | null; planId: string | null }[];
  nextCursor: string | null;
  canManage: boolean;
};
