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
import { jobsByTypeQueryOptions } from "@/features/jobs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";

import { createManagedPopulationTypeMutationOptions } from "../../mutations/managedPopulationsMutations";
import {
  activeManagedPopulationTypesByWorldQueryOptions,
  managedPopulationTypesPageQueryOptions,
} from "../../queries/managedPopulationsQueries";

import { CreateManagedPopulationTypeForm } from "./components/CreateManagedPopulationTypeForm";
import { ManagedPopulationTypesTable } from "./components/ManagedPopulationTypesTable";

import type { CreateManagedPopulationTypeInput } from "../../schemas/managedPopulationSchemas";

const PAGE_SIZE = 25;

type ManagedPopulationsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function ManagedPopulationsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: ManagedPopulationsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  const populationTypesPageQuery = useQuery(
    managedPopulationTypesPageQueryOptions(worldId, {
      page: pageIndex,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      trash: showTrash,
    }),
  );

  // Unpaginated active list, used only to feed the create/edit forms'
  // client-side slug/name conflict validation — must stay the full active
  // list, not the currently visible page slice, or conflicts outside the
  // page would be silently missed.
  const activePopulationTypesQuery = useQuery(
    activeManagedPopulationTypesByWorldQueryOptions(worldId),
  );

  const husbandryJobsQuery = useQuery(
    jobsByTypeQueryOptions(worldId, "husbandry"),
  );
  const cullingJobsQuery = useQuery(jobsByTypeQueryOptions(worldId, "culling"));

  const createMutation = useMutation(
    createManagedPopulationTypeMutationOptions({ queryClient }),
  );

  function resetToFirstPage(): void {
    setPageIndex(0);
  }

  const items = populationTypesPageQuery.data?.items ?? [];
  const totalCount = populationTypesPageQuery.data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const allPopulationTypes = activePopulationTypesQuery.data ?? [];
  const husbandryJobs = husbandryJobsQuery.data ?? [];
  const cullingJobs = cullingJobsQuery.data ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">
          Managed Population Types
        </h2>
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
              Add population type
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

      <Input
        aria-label="Search population types by name"
        className="sm:w-[280px]"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => {
          setSearch(event.currentTarget.value);
          resetToFirstPage();
        }}
      />

      {populationTypesPageQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={PAGE_SIZE} />
      ) : populationTypesPageQuery.isError ? (
        <ErrorState
          title="Managed population types could not be loaded"
          description={getErrorDescription(populationTypesPageQuery.error)}
        />
      ) : items.length === 0 ? (
        showTrash ? (
          <EmptyState title="No managed population types in trash" />
        ) : debouncedSearch !== "" ? (
          <EmptyState
            title="No matching managed population types"
            description="Try a different search."
          />
        ) : (
          <EmptyState
            title="No managed population types yet"
            description="Add the first managed population type for this world."
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
          <ManagedPopulationTypesTable
            allPopulationTypes={allPopulationTypes}
            canEdit={canEdit}
            cullingJobs={cullingJobs}
            husbandryJobs={husbandryJobs}
            isPaginationDisabled={populationTypesPageQuery.isFetching}
            pageCount={pageCount}
            pageIndex={pageIndex}
            populationTypes={items}
            queryClient={queryClient}
            showTrash={showTrash}
            worldId={worldId}
            onPageChange={setPageIndex}
          />
        </>
      )}

      {canEdit && showForm && !showTrash ? (
        <CreateManagedPopulationTypeForm
          allPopulationTypes={allPopulationTypes}
          cullingJobs={cullingJobs}
          husbandryJobs={husbandryJobs}
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input: CreateManagedPopulationTypeInput) => {
            createMutation.mutate(input, {
              onError: (error) => {
                handleCrudError(
                  error,
                  "Failed to create managed population type.",
                );
              },
              onSuccess: () => {
                notifyMutationSuccess("Managed population type created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
