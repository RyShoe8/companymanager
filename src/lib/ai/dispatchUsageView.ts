export type DispatchUsageView = {
  asOf: string;
  utcDay: string;
  attempts: number;
  dailyLimit: number;
  remaining: number;
  lastAttemptAt: string | null;
  nextEligibleAt: string;
  processingEnabled: boolean;
};
