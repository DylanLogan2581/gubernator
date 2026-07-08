import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import type { Nation } from "@/features/nations";
import { nationSettlementsQueryOptions } from "@/features/nations";
import {
  checkCanManageNation,
  useActivePlayerCharacter,
} from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  armiesByNationQueryOptions,
  armyLatestSnapshotsQueryOptions,
  armySoldierCountsQueryOptions,
} from "../../queries/armiesQueries";

import { ArmyCard } from "./ArmyCard";
import { CreateArmyDialog } from "./CreateArmyDialog";

export function NationMilitarySection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const { activeCharacter } = useActivePlayerCharacter();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const canManage = checkCanManageNation({
    activeCharacter,
    canAdmin: canAdminWorld,
    nationId: nation.id,
  });

  const armiesQuery = useQuery(armiesByNationQueryOptions(nation.id));
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nation.id));

  const armies = armiesQuery.data ?? [];
  const armyIds = useMemo(
    () => (armiesQuery.data ?? []).map((a) => a.id),
    [armiesQuery.data],
  );

  const soldierCountsQuery = useQuery(armySoldierCountsQueryOptions(armyIds));
  const snapshotsQuery = useQuery(armyLatestSnapshotsQueryOptions(armyIds));

  const settlementNameById = useMemo(
    () => new Map((settlementsQuery.data ?? []).map((s) => [s.id, s.name])),
    [settlementsQuery.data],
  );

  if (armiesQuery.isPending) {
    return <LoadingState label="Loading armies…" />;
  }

  if (armiesQuery.isError) {
    return (
      <ErrorState
        title="Armies could not be loaded"
        description={getErrorDescription(armiesQuery.error)}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-medium">Military</h2>
        {canManage && !isArchived ? (
          <Button type="button" onClick={() => setIsCreating(true)}>
            Create army
          </Button>
        ) : null}
      </div>

      {armies.length === 0 ? (
        <EmptyState
          title="No armies yet"
          description="Create an army to start organizing this nation's military."
          action={
            canManage && !isArchived ? (
              <Button type="button" onClick={() => setIsCreating(true)}>
                Create army
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {armies.map((army) => (
            <ArmyCard
              key={army.id}
              army={army}
              canManage={canManage && !isArchived}
              latestSnapshot={snapshotsQuery.data?.[army.id]}
              nationId={nation.id}
              queryClient={queryClient}
              settlementNameById={settlementNameById}
              soldierCount={soldierCountsQuery.data?.[army.id] ?? 0}
              worldId={nation.worldId}
            />
          ))}
        </div>
      )}

      {isCreating ? (
        <CreateArmyDialog
          nationId={nation.id}
          queryClient={queryClient}
          onClose={() => setIsCreating(false)}
        />
      ) : null}
    </div>
  );
}
