import type { JobType } from "../types/jobTypes";

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  construction: "Construction",
  culling: "Culling",
  deposit: "Deposit",
  husbandry: "Husbandry",
  standard: "Standard",
  trader: "Trader",
};
