import { useQuery } from "@tanstack/react-query";

import { SearchableResourcePicker } from "@/components/shared/SearchableResourcePicker";
import { Label } from "@/components/ui/label";
import { jobsByWorldQueryOptions, type JobDefinition } from "@/features/jobs";

import { MultiplierInput, ZeroTargetAlert } from "./Shared";

import type { EffectEditorProps } from "./Types";
import type { JSX } from "react";

/** Editor for the production_multiplier effect (multiplier + job targeting). */
export function ProductionMultiplierEditor({
  effect,
  index,
  onUpdate,
  worldId,
  selectedIds,
  scopeType,
}: EffectEditorProps): JSX.Element {
  const jobsQuery = useQuery(jobsByWorldQueryOptions(worldId));

  return (
    <>
      <ZeroTargetAlert
        effect={effect}
        worldId={worldId}
        scopeType={scopeType}
        selectedIds={selectedIds}
      />

      <div className="space-y-2">
        <MultiplierInput effect={effect} index={index} onUpdate={onUpdate} />

        <p className="text-sm text-muted-foreground">
          Multiply job output production. Can optionally be scoped to all jobs
          or specific jobs.
        </p>

        {/* Job target mode toggle and selector */}
        {jobsQuery.data !== undefined && (
          <div className="space-y-2 pt-2">
            <Label>Target Jobs</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={effect.jobMode !== "select"}
                  onChange={() =>
                    onUpdate({
                      ...effect,
                      jobMode: "all",
                      jobIds: undefined,
                    })
                  }
                />
                <span className="text-sm">All Jobs</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={effect.jobMode === "select"}
                  onChange={() =>
                    onUpdate({
                      ...effect,
                      jobMode: "select",
                      jobIds: effect.jobIds ?? [],
                    })
                  }
                />
                <span className="text-sm">Select Jobs</span>
              </label>
            </div>

            {effect.jobMode === "all" ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                ✓ All {jobsQuery.data.length} jobs selected
              </p>
            ) : (
              jobsQuery.data.length > 0 && (
                <SearchableResourcePicker
                  resources={jobsQuery.data.map((j: JobDefinition) => ({
                    id: j.id,
                    name: j.name,
                  }))}
                  selectedIds={effect.jobIds ?? []}
                  onSelectionChange={(ids) =>
                    onUpdate({
                      ...effect,
                      jobIds: ids,
                    })
                  }
                />
              )
            )}

            {jobsQuery.data.length === 0 && (
              <p className="text-sm text-muted-foreground">No jobs available</p>
            )}

            {effect.jobMode === "select" &&
              (effect.jobIds === undefined || effect.jobIds.length === 0) && (
                <p className="text-sm text-destructive">
                  Select at least one job, or choose All Jobs.
                </p>
              )}
          </div>
        )}

        {jobsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading jobs...</p>
        )}
      </div>
    </>
  );
}
