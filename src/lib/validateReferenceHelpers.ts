export type ReferenceIssue = {
  readonly field: string;
  readonly message: string;
};

export function checkResourceIdsInWorld(
  field: string,
  entries: readonly { readonly resourceId: string }[],
  activeResourceIds: ReadonlySet<string>,
  issues: ReferenceIssue[],
): void {
  for (const entry of entries) {
    if (!activeResourceIds.has(entry.resourceId)) {
      issues.push({
        field,
        message: `Resource ${entry.resourceId} is not an active resource in this world.`,
      });
    }
  }
}

type MinimalJob = { readonly id: string; readonly jobType: string };

export function checkJobLinkExpectedType(
  field: string,
  jobId: string,
  activeJobs: readonly MinimalJob[],
  expectedType: string,
  issues: ReferenceIssue[],
): void {
  const job = activeJobs.find((j) => j.id === jobId);
  if (job === undefined) {
    issues.push({
      field,
      message: `Job ${jobId} is not an active job in this world.`,
    });
  } else if (job.jobType !== expectedType) {
    issues.push({
      field,
      message: `Job ${jobId} must have job type '${expectedType}'.`,
    });
  }
}
