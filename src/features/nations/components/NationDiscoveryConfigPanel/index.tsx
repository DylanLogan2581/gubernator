import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Input } from "@/components/ui/input";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  setNationsMetMutationOptions,
  setNationsUnmetMutationOptions,
} from "../../mutations/nationDiscoveryMutations";
import { nationDiscoveriesQueryOptions } from "../../queries/nationDiscoveryQueries";
import { nationsListQueryOptions } from "../../queries/nationsQueries";

import { NationDiscoveryGrid } from "./NationDiscoveryGrid";
import { NationDiscoveryList } from "./NationDiscoveryList";
import {
  buildDiscoveryPairMap,
  discoveryPairKey,
} from "./NationDiscoveryUtils";

import type { Nation } from "../../types/nationTypes";

type NationDiscoveryConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function NationDiscoveryConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: NationDiscoveryConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [bulkPendingNationId, setBulkPendingNationId] = useState<string | null>(
    null,
  );

  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const discoveriesQuery = useQuery(nationDiscoveriesQueryOptions(worldId));

  const setMetMutation = useMutation(
    setNationsMetMutationOptions({ queryClient }),
  );
  const setUnmetMutation = useMutation(
    setNationsUnmetMutationOptions({ queryClient }),
  );

  const canEdit = canAdmin && !isArchived;

  if (nationsQuery.isPending || discoveriesQuery.isPending) {
    return <LoadingState label="Loading nation discovery…" />;
  }

  if (nationsQuery.isError) {
    return (
      <ErrorState
        title="Nations could not be loaded"
        description={getErrorDescription(nationsQuery.error)}
      />
    );
  }

  if (discoveriesQuery.isError) {
    return (
      <ErrorState
        title="Nation discoveries could not be loaded"
        description={getErrorDescription(discoveriesQuery.error)}
      />
    );
  }

  const nations = nationsQuery.data;
  const matchedNations =
    search.trim().length === 0
      ? nations
      : nations.filter((nation) =>
          nation.name.toLowerCase().includes(search.trim().toLowerCase()),
        );
  const pairsByKey = buildDiscoveryPairMap(discoveriesQuery.data);

  function handleToggle(nationA: Nation, nationB: Nation, met: boolean): void {
    const key = discoveryPairKey(nationA.id, nationB.id);
    setPendingKey(key);

    const mutation = met ? setMetMutation : setUnmetMutation;
    mutation.mutate(
      { nationAId: nationA.id, nationBId: nationB.id, worldId },
      {
        onError: (error) => {
          setPendingKey(null);
          notifyMutationError(
            error,
            met
              ? "Could not mark nations as met."
              : "Could not mark nations as unmet.",
          );
        },
        onSuccess: () => {
          setPendingKey(null);
          notifyMutationSuccess(
            met ? "Nations marked as met." : "Nations marked as unmet.",
          );
        },
      },
    );
  }

  async function handleDiscoverAll(nation: Nation): Promise<void> {
    const undiscovered = nations.filter(
      (other) =>
        other.id !== nation.id &&
        !pairsByKey.has(discoveryPairKey(nation.id, other.id)),
    );

    if (undiscovered.length === 0) {
      return;
    }

    setBulkPendingNationId(nation.id);
    const results = await Promise.allSettled(
      undiscovered.map((other) =>
        setMetMutation.mutateAsync({
          nationAId: nation.id,
          nationBId: other.id,
          worldId,
        }),
      ),
    );
    setBulkPendingNationId(null);

    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (firstFailure !== undefined) {
      notifyMutationError(
        firstFailure.reason,
        `Could not mark ${nation.name} as met with all nations.`,
      );
    } else {
      notifyMutationSuccess(`${nation.name} marked as met with all nations.`);
    }
  }

  async function handleClearAll(nation: Nation): Promise<void> {
    const discovered = nations.filter(
      (other) =>
        other.id !== nation.id &&
        pairsByKey.has(discoveryPairKey(nation.id, other.id)),
    );

    if (discovered.length === 0) {
      return;
    }

    setBulkPendingNationId(nation.id);
    const results = await Promise.allSettled(
      discovered.map((other) =>
        setUnmetMutation.mutateAsync({
          nationAId: nation.id,
          nationBId: other.id,
          worldId,
        }),
      ),
    );
    setBulkPendingNationId(null);

    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (firstFailure !== undefined) {
      notifyMutationError(
        firstFailure.reason,
        `Could not mark ${nation.name} as unmet with all nations.`,
      );
    } else {
      notifyMutationSuccess(`${nation.name} marked as unmet with all nations.`);
    }
  }

  if (nations.length < 2) {
    return (
      <div className="flex flex-col gap-4">
        <DiscoveryHeader />
        <EmptyState
          title="Not enough nations"
          description="Discovery pairs need at least two nations in this world."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DiscoveryHeader />

      <Input
        aria-label="Search nations"
        placeholder="Search nations…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
        }}
      />

      {matchedNations.length === 0 ? (
        <EmptyState
          title="No matching nations"
          description="Adjust your search to see nation pairs."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <NationDiscoveryGrid
              bulkPendingNationId={bulkPendingNationId}
              canEdit={canEdit}
              columns={nations}
              pairsByKey={pairsByKey}
              pendingKey={pendingKey}
              rows={matchedNations}
              onClearAll={(nation) => {
                void handleClearAll(nation);
              }}
              onDiscoverAll={(nation) => {
                void handleDiscoverAll(nation);
              }}
              onToggle={handleToggle}
            />
          </div>
          <div className="md:hidden">
            <NationDiscoveryList
              canEdit={canEdit}
              columns={nations}
              pairsByKey={pairsByKey}
              pendingKey={pendingKey}
              rows={matchedNations}
              onToggle={handleToggle}
            />
          </div>
        </>
      )}
    </div>
  );
}

function DiscoveryHeader(): JSX.Element {
  return (
    <div>
      <h2 className="text-base font-medium">Discovery</h2>
      <p className="text-sm text-muted-foreground">
        Mark which nations have met. Two nations only interact once they have
        been marked as having met.
      </p>
    </div>
  );
}
