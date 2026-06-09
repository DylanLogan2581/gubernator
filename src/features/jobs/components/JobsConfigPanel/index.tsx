import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import {
  ConfigCrudPanel,
  handleCrudError,
} from "@/components/shared/ConfigCrudPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { notifyMutationSuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

import { createJobMutationOptions } from "../../mutations/jobsMutations";
import { jobsByWorldQueryOptions } from "../../queries/jobsQueries";

import { EditJobForm } from "./EditJobForm";
import { CreateJobForm } from "./JobForm";
import { JobList, JOB_TYPE_LABELS } from "./JobList";

import type { JobDefinition, JobType } from "../../types/jobTypes";

const JOB_TYPES: readonly { label: string; value: JobType }[] = [
  { label: "Standard", value: "standard" },
  { label: "Construction", value: "construction" },
  { label: "Deposit", value: "deposit" },
  { label: "Husbandry", value: "husbandry" },
  { label: "Culling", value: "culling" },
  { label: "Trader", value: "trader" },
];

type JobsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function JobsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: JobsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const jobsQuery = useQuery(jobsByWorldQueryOptions(worldId));
  const canEdit = canAdmin && !isArchived;
  const [typeFilter, setTypeFilter] = useState<JobType | "all">("all");
  const createMutation = useMutation(createJobMutationOptions({ queryClient }));

  return (
    <ConfigCrudPanel<JobDefinition>
      addButtonLabel="Add job"
      allData={jobsQuery}
      canEdit={canEdit}
      emptyTitle="No jobs yet"
      emptyDescription="Add the first job for this world."
      headerTitle="Jobs"
      isTrashed={(job) => job.isTrashed}
      renderContent={({
        canEdit: canEditProp,
        editingId,
        items,
        queryClient: qc,
        setEditingId,
        setShowForm,
        showForm,
        showTrash,
      }) => {
        const filteredJobs =
          typeFilter === "all"
            ? items
            : items.filter((job) => job.jobType === typeFilter);

        return (
          <>
            <div
              role="group"
              aria-label="Filter by job type"
              className="flex flex-wrap gap-1"
            >
              <button
                type="button"
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                  typeFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
                onClick={() => {
                  setTypeFilter("all");
                }}
              >
                All types
              </button>
              {JOB_TYPES.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium transition-colors",
                    typeFilter === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                  onClick={() => {
                    setTypeFilter(value);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredJobs.length > 0 ? (
              <JobList
                canEdit={canEditProp}
                editingJobId={editingId}
                jobs={filteredJobs}
                queryClient={qc}
                showTrash={showTrash}
                worldId={worldId}
                onEditingChange={setEditingId}
                onRenderEditForm={(job) => (
                  <EditJobForm
                    job={job}
                    queryClient={qc}
                    worldId={worldId}
                    onClose={() => {
                      setEditingId(null);
                    }}
                  />
                )}
              />
            ) : showTrash ? null : typeFilter !== "all" ? (
              <EmptyState
                title={`No ${JOB_TYPE_LABELS[typeFilter].toLowerCase()} jobs`}
              />
            ) : null}

            {canEditProp && showForm && !showTrash ? (
              <CreateJobForm
                isPending={createMutation.isPending}
                worldId={worldId}
                onCancel={() => {
                  setShowForm(false);
                }}
                onSubmit={(input) => {
                  createMutation.mutate(input, {
                    onError: (error) => {
                      handleCrudError(error, "Failed to create job.");
                    },
                    onSuccess: () => {
                      notifyMutationSuccess("Job created.");
                      setShowForm(false);
                    },
                  });
                }}
              />
            ) : null}
          </>
        );
      }}
    />
  );
}
