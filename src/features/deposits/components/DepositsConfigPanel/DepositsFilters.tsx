import { type JSX } from "react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { type JobDefinition } from "@/features/jobs";

type DepositsFiltersProps = {
  readonly depositJobs: readonly JobDefinition[];
  readonly jobId: string | null;
  readonly onJobIdChange: (jobId: string | null) => void;
  readonly onSearchChange: (search: string) => void;
  readonly search: string;
};

export function DepositsFilters({
  depositJobs,
  jobId,
  onJobIdChange,
  onSearchChange,
  search,
}: DepositsFiltersProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Search deposit types by name"
        className="sm:w-[280px]"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => {
          onSearchChange(event.currentTarget.value);
        }}
      />
      <NativeSelect
        aria-label="Filter by linked job"
        className="sm:w-[220px]"
        value={jobId ?? ""}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onJobIdChange(next === "" ? null : next);
        }}
      >
        <option value="">All jobs</option>
        {depositJobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
