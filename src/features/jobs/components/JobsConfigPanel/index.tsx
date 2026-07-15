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
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";

import { createJobMutationOptions } from "../../mutations/jobsMutations";
import { jobsPageQueryOptions } from "../../queries/jobsQueries";
import { JOB_TYPE_LABELS } from "../../utils/jobTypeLabels";

import { CreateJobForm } from "./JobForm";
import { JobsFilters } from "./JobsFilters";
import { JobsTable } from "./JobsTable";

import type { JobsSortBy } from "../../queries/jobsQueries";
import type { CreateJobInput } from "../../schemas/jobSchemas";
import type { JobType } from "../../types/jobTypes";
import type { SortingState } from "@tanstack/react-table";

const PAGE_SIZE = 25;

// Maps a DataTable column id to the jobs page query's sort column (see
// jobsQueries.ts), mirroring the resources config panel's pattern.
const SORT_BY_ID: Record<string, JobsSortBy> = {
  capacity: "capacity",
  education: "education",
  name: "name",
  tradersPerWorker: "tradersPerWorker",
  type: "type",
};

type JobsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

function JobsEmptyState({
  debouncedSearch,
  educationLevelId,
  showTrash,
  typesFilter,
}: {
  readonly debouncedSearch: string;
  readonly educationLevelId: string | null;
  readonly showTrash: boolean;
  readonly typesFilter: readonly JobType[];
}): JSX.Element {
  if (showTrash) {
    return <EmptyState title="No jobs in trash" />;
  }
  if (debouncedSearch !== "") {
    return (
      <EmptyState
        title="No matching jobs"
        description="Try a different search."
      />
    );
  }
  if (typesFilter.length === 1) {
    return (
      <EmptyState
        title={`No ${JOB_TYPE_LABELS[typesFilter[0]].toLowerCase()} jobs`}
      />
    );
  }
  if (typesFilter.length > 1 || educationLevelId !== null) {
    return (
      <EmptyState
        title="No matching jobs"
        description="Try different filters."
      />
    );
  }
  return (
    <EmptyState
      title="No jobs yet"
      description="Add the first job for this world."
    />
  );
}

export function JobsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: JobsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [search, setSearch] = useState("");
  const [educationLevelId, setEducationLevelId] = useState<string | null>(null);
  const [typesFilter, setTypesFilter] = useState<readonly JobType[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  const activeSort = sorting[0];
  const sortBy: JobsSortBy | undefined =
    activeSort !== undefined ? SORT_BY_ID[activeSort.id] : undefined;

  const jobsQuery = useQuery(
    jobsPageQueryOptions(worldId, {
      educationLevelId,
      jobTypes: typesFilter.length > 0 ? typesFilter : undefined,
      page: pageIndex,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      sortBy,
      sortDirection: activeSort?.desc === true ? "desc" : "asc",
      trash: showTrash,
    }),
  );
  const createMutation = useMutation(createJobMutationOptions({ queryClient }));
  const educationLevelsQuery = useQuery(
    educationLevelsByWorldQueryOptions(worldId),
  );
  const educationLevels = educationLevelsQuery.data ?? [];

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

      <JobsFilters
        educationLevelId={educationLevelId}
        educationLevels={educationLevels}
        search={search}
        types={typesFilter}
        worldId={worldId}
        onEducationLevelIdChange={(next) => {
          setEducationLevelId(next);
          resetToFirstPage();
        }}
        onSearchChange={(next) => {
          setSearch(next);
          resetToFirstPage();
        }}
        onTypesChange={(next) => {
          setTypesFilter(next);
          resetToFirstPage();
        }}
      />

      {jobsQuery.isPending ? (
        <TableSkeleton columnCount={5} rowCount={PAGE_SIZE} />
      ) : jobsQuery.isError ? (
        <ErrorState
          title="Jobs could not be loaded"
          description={getErrorDescription(jobsQuery.error)}
        />
      ) : items.length === 0 ? (
        <JobsEmptyState
          debouncedSearch={debouncedSearch}
          educationLevelId={educationLevelId}
          showTrash={showTrash}
          typesFilter={typesFilter}
        />
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
            educationLevels={educationLevels}
            isPaginationDisabled={jobsQuery.isFetching}
            jobs={items}
            pageCount={pageCount}
            pageIndex={pageIndex}
            queryClient={queryClient}
            showTrash={showTrash}
            sorting={sorting}
            worldId={worldId}
            onPageChange={setPageIndex}
            onSortingChange={(next) => {
              setSorting(next);
              resetToFirstPage();
            }}
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
