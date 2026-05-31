import type { JobType } from "../types/jobTypes";

const JOB_TYPES = new Set<string>([
  "construction",
  "culling",
  "deposit",
  "husbandry",
  "standard",
  "trader",
]);

export function parseJobType(value: string): JobType {
  if (!JOB_TYPES.has(value)) {
    throw new Error(`Unknown job_type from database: "${value}"`);
  }
  return value as JobType;
}
