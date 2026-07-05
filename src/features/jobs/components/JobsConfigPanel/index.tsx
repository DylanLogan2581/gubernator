import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type JSX } from "react";

import {
  handleCrudError,
  TrashToggleButton,
} from "@/components/shared/ConfigCrudPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

import { createJobMutationOptions } from "../../mutations/jobsMutations";
import { jobsPageQueryOptions } from "../../queries/jobsQueries";

import { CreateJobForm } from "./JobForm";
import { JOB_TYPE_LABELS, JobsTable } from "./JobsTable";

import type { CreateJobInput } from "../../schemas/jobSchemas";
import type { JobType } from "../../types/jobTypes";

const PAGE_SIZE = 25;

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
  const canEdit = canAdmin && !isArchived;

  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<JobType | "all">("all");

  const debouncedSearch = useDebouncedValue(search, 300);

  const jobsQuery = useQuery(
    jobsPageQueryOptions(worldId, {
      jobType: typeFilter === "all" ? undefined : typeFilter,
      page: pageIndex,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      trash: showTrash,
    }),
  );
  const createMutation = useMutation(createJobMutationOptions({ queryClient }));

  function resetToFirstPage(): void {
    setPageIndex(0);
  }

  const items = jobsQuery.data?.items ?? [];
  const totalCount = jobsQuery.data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">Jobs</h2>
        <div className="flex items-center gap-2">
          {canEdit && !showForm && !showTrash ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(true);
              }}
            >
              <Plus aria-hidden="true" />
              Add job
            </Button>
          ) : null}
          <TrashToggleButton
            isActive={showTrash}
            onClick={() => {
              setShowTrash((v) => !v);
              resetToFirstPage();
            }}
          />
        </div>
      </div>

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
            resetToFirstPage();
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
              resetToFirstPage();
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <Input
        aria-label="Search jobs by name"
        className="sm:w-[280px]"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => {
          setSearch(event.currentTarget.value);
          resetToFirstPage();
        }}
      />

      {jobsQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={PAGE_SIZE} />
      ) : jobsQuery.isError ? (
        <ErrorState
          title="Jobs could not be loaded"
          description={getErrorDescription(jobsQuery.error)}
        />
      ) : items.length === 0 ? (
        showTrash ? (
          <EmptyState title="No jobs in trash" />
        ) : debouncedSearch !== "" ? (
          <EmptyState
            title="No matching jobs"
            description="Try a different search."
          />
        ) : typeFilter !== "all" ? (
          <EmptyState
            title={`No ${JOB_TYPE_LABELS[typeFilter].toLowerCase()} jobs`}
          />
        ) : (
          <EmptyState
            title="No jobs yet"
            description="Add the first job for this world."
          />
        )
      ) : (
        <>
          <p className="text-xs text-muted-foreground" role="status">
            {`Showing ${(pageIndex * PAGE_SIZE + 1).toString()}–${(
              pageIndex * PAGE_SIZE +
              items.length
            ).toString()} of ${totalCount.toString()}`}
          </p>
          <JobsTable
            canEdit={canEdit}
            isPaginationDisabled={jobsQuery.isFetching}
            jobs={items}
            pageCount={pageCount}
            pageIndex={pageIndex}
            queryClient={queryClient}
            showTrash={showTrash}
            worldId={worldId}
            onPageChange={setPageIndex}
          />
        </>
      )}

      {canEdit && showForm && !showTrash ? (
        <CreateJobForm
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input: CreateJobInput) => {
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
    </div>
  );
}
