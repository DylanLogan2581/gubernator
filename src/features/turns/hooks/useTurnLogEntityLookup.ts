// Batch-resolves entity ids embedded in turn log payloads (not the log
// entry's own citizen/settlement/nation id, which the query already joins)
// to names + links, one query per entity kind for the ids visible on the
// current page. Citizens can number in the thousands per world, so they're
// looked up by the specific ids referenced; buildings/jobs/resources are
// world-scoped config/state already fetched in full elsewhere in the app, so
// reusing those cached lists avoids a second lookup mechanism.

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { settlementBuildingsByWorldQueryOptions } from "@/features/buildings";
import { citizensByIdsQueryOptions } from "@/features/citizens";
import { jobsByWorldQueryOptions } from "@/features/jobs";
import { resourcesByWorldQueryOptions } from "@/features/resources";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import {
  parseBuildingAutoDeconstructedPayload,
  parseBuildingSuspendedPayload,
  parsePartnershipFormedPayload,
  parsePartnershipWidowedPayload,
} from "@/shared/simulation/outcomes/notificationPayloads";

import type { TurnLogBrowserEntry } from "../queries/turnLogBrowserQueries";

export type ResolvedEntityRef = {
  readonly name: string | null;
  readonly href: string | null;
};

export type TurnLogEntityLookup = {
  readonly isLoading: boolean;
  readonly citizen: (citizenId: string) => ResolvedEntityRef;
  readonly building: (
    buildingId: string,
  ) => ResolvedEntityRef & { readonly blueprintName: string | null };
  readonly jobName: (jobId: string) => string | null;
  readonly resourceName: (resourceId: string) => string | null;
};

function citizenIdsInPayload(
  logCategory: string,
  payload: unknown,
): readonly string[] {
  switch (logCategory) {
    case "partnership.formed": {
      const p = parsePartnershipFormedPayload(payload);
      return p === null ? [] : [p.citizenAId, p.citizenBId];
    }
    case "partnership.widowed": {
      const p = parsePartnershipWidowedPayload(payload);
      return p === null ? [] : [p.survivingCitizenId];
    }
    default:
      return [];
  }
}

function buildingIdInPayload(
  logCategory: string,
  payload: unknown,
): string | null {
  switch (logCategory) {
    case "building.auto_deconstructed":
      return parseBuildingAutoDeconstructedPayload(payload)?.buildingId ?? null;
    case "building.suspended":
      return parseBuildingSuspendedPayload(payload)?.buildingId ?? null;
    default:
      return null;
  }
}

export function useTurnLogEntityLookup(
  worldId: string,
  entries: readonly TurnLogBrowserEntry[],
): TurnLogEntityLookup {
  const citizenIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of entries) {
      for (const id of citizenIdsInPayload(
        entry.logCategory,
        entry.payloadJsonb,
      )) {
        ids.add(id);
      }
    }
    return [...ids];
  }, [entries]);

  const needsBuildings = useMemo(
    () =>
      entries.some(
        (entry) =>
          buildingIdInPayload(entry.logCategory, entry.payloadJsonb) !== null,
      ),
    [entries],
  );
  const needsJobsOrResources = useMemo(
    () =>
      entries.some((entry) => entry.logCategory === "standard_job.processed"),
    [entries],
  );

  const citizensQuery = useQuery(citizensByIdsQueryOptions(citizenIds));
  const buildingsQuery = useQuery({
    ...settlementBuildingsByWorldQueryOptions(worldId),
    enabled: needsBuildings,
  });
  const settlementsQuery = useQuery({
    ...settlementsByWorldQueryOptions(worldId),
    enabled: needsBuildings,
  });
  const jobsQuery = useQuery({
    ...jobsByWorldQueryOptions(worldId),
    enabled: needsJobsOrResources,
  });
  const resourcesQuery = useQuery({
    ...resourcesByWorldQueryOptions(worldId),
    enabled: needsJobsOrResources,
  });

  return useMemo<TurnLogEntityLookup>(() => {
    const citizenById = new Map(
      (citizensQuery.data ?? []).map((c) => [c.id, c]),
    );
    const buildingById = new Map(
      (buildingsQuery.data ?? []).map((b) => [b.id, b]),
    );
    const nationIdBySettlementId = new Map(
      (settlementsQuery.data ?? []).map((s) => [s.id, s.nationId]),
    );
    const jobNameById = new Map(
      (jobsQuery.data ?? []).map((j) => [j.id, j.name]),
    );
    const resourceNameById = new Map(
      (resourcesQuery.data ?? []).map((r) => [r.id, r.name]),
    );

    return {
      isLoading:
        (citizenIds.length > 0 && citizensQuery.isPending) ||
        (needsBuildings &&
          (buildingsQuery.isPending || settlementsQuery.isPending)) ||
        (needsJobsOrResources &&
          (jobsQuery.isPending || resourcesQuery.isPending)),
      citizen: (citizenId) => {
        const citizen = citizenById.get(citizenId);
        return {
          name: citizen?.name ?? null,
          href: `/worlds/${worldId}/citizens/${citizenId}`,
        };
      },
      building: (buildingId) => {
        const building = buildingById.get(buildingId);
        if (building === undefined) {
          return { name: null, href: null, blueprintName: null };
        }
        const nationId = nationIdBySettlementId.get(building.settlementId);
        return {
          name: building.name ?? building.blueprintName,
          href:
            nationId === undefined
              ? null
              : `/worlds/${worldId}/nations/${nationId}/settlements/${building.settlementId}`,
          blueprintName: building.blueprintName,
        };
      },
      jobName: (jobId) => jobNameById.get(jobId) ?? null,
      resourceName: (resourceId) => resourceNameById.get(resourceId) ?? null,
    };
  }, [
    citizenIds.length,
    citizensQuery.data,
    citizensQuery.isPending,
    buildingsQuery.data,
    buildingsQuery.isPending,
    settlementsQuery.data,
    settlementsQuery.isPending,
    jobsQuery.data,
    jobsQuery.isPending,
    resourcesQuery.data,
    resourcesQuery.isPending,
    needsBuildings,
    needsJobsOrResources,
    worldId,
  ]);
}
