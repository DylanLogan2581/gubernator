import { type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { EducationLevel } from "@/features/education";

import { JOB_TYPE_LABELS } from "../../utils/jobTypeLabels";

import type { JobType } from "../../types/jobTypes";

const JOB_TYPES: readonly JobType[] = [
  "standard",
  "construction",
  "deposit",
  "husbandry",
  "culling",
  "trader",
];

type JobsFiltersProps = {
  readonly educationLevelId: string | null;
  readonly educationLevels: readonly EducationLevel[];
  readonly onEducationLevelIdChange: (educationLevelId: string | null) => void;
  readonly onSearchChange: (search: string) => void;
  readonly onTypesChange: (types: readonly JobType[]) => void;
  readonly search: string;
  readonly types: readonly JobType[];
};

export function JobsFilters({
  educationLevelId,
  educationLevels,
  onEducationLevelIdChange,
  onSearchChange,
  onTypesChange,
  search,
  types,
}: JobsFiltersProps): JSX.Element {
  function toggleType(type: JobType): void {
    onTypesChange(
      types.includes(type) ? types.filter((t) => t !== type) : [...types, type],
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Search jobs by name"
        className="sm:w-[280px]"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => {
          onSearchChange(event.currentTarget.value);
        }}
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Job type
            {types.length > 0 ? (
              <Badge variant="default" className="ml-1">
                {types.length}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 p-3"
          role="group"
          aria-label="Filter by job type"
        >
          <div className="grid gap-2">
            {JOB_TYPES.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 text-sm font-normal"
              >
                <Checkbox
                  checked={types.includes(type)}
                  onCheckedChange={() => {
                    toggleType(type);
                  }}
                />
                {JOB_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <NativeSelect
        aria-label="Filter by required education level"
        className="sm:w-[220px]"
        value={educationLevelId ?? ""}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onEducationLevelIdChange(next === "" ? null : next);
        }}
      >
        <option value="">All education levels</option>
        {educationLevels.map((level) => (
          <option key={level.id} value={level.id}>
            {level.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
