import { type JSX } from "react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { type JobDefinition } from "@/features/jobs";

type ManagedPopulationsFiltersProps = {
  readonly cullingJobId: string | null;
  readonly cullingJobs: readonly JobDefinition[];
  readonly husbandryJobId: string | null;
  readonly husbandryJobs: readonly JobDefinition[];
  readonly onCullingJobIdChange: (jobId: string | null) => void;
  readonly onHusbandryJobIdChange: (jobId: string | null) => void;
  readonly onSearchChange: (search: string) => void;
  readonly search: string;
};

export function ManagedPopulationsFilters({
  cullingJobId,
  cullingJobs,
  husbandryJobId,
  husbandryJobs,
  onCullingJobIdChange,
  onHusbandryJobIdChange,
  onSearchChange,
  search,
}: ManagedPopulationsFiltersProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Search population types by name"
        className="sm:w-[280px]"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => {
          onSearchChange(event.currentTarget.value);
        }}
      />
      <NativeSelect
        aria-label="Filter by husbandry job"
        className="sm:w-[220px]"
        value={husbandryJobId ?? ""}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onHusbandryJobIdChange(next === "" ? null : next);
        }}
      >
        <option value="">All husbandry jobs</option>
        {husbandryJobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Filter by culling job"
        className="sm:w-[220px]"
        value={cullingJobId ?? ""}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onCullingJobIdChange(next === "" ? null : next);
        }}
      >
        <option value="">All culling jobs</option>
        {cullingJobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
