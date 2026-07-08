import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil, Swords, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { citizensByIdsQueryOptions } from "@/features/citizens";
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  deleteArmyUnitMutationOptions,
  moveArmyUnitMutationOptions,
  renameArmyUnitMutationOptions,
} from "../../mutations/armyTreeMutations";
import { dischargeSoldiersMutationOptions } from "../../mutations/recruitmentMutations";
import { unitSoldiersByUnitQueryOptions } from "../../queries/armiesQueries";
import { unitTypesByWorldQueryOptions } from "../../queries/unitTypesQueries";

import { RecruitDialog } from "./RecruitDialog";
import { MoveNodeDialog, RenameNodeDialog } from "./TreeNodeDialogs";

import type { ArmyFundingSource, ArmyUnit } from "../../types/armyTypes";

export function UnitNode({
  armyFundingSource,
  armyId,
  armyStationedSettlementId,
  canManage,
  nationId,
  queryClient,
  unit,
  worldId,
}: {
  readonly armyFundingSource: ArmyFundingSource;
  readonly armyId: string;
  readonly armyStationedSettlementId: string;
  readonly canManage: boolean;
  readonly nationId: string;
  readonly queryClient: QueryClient;
  readonly unit: ArmyUnit;
  readonly worldId: string;
}): JSX.Element {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecruiting, setIsRecruiting] = useState(false);
  const [isDischarging, setIsDischarging] = useState(false);
  const [selectedSoldierIds, setSelectedSoldierIds] = useState<
    ReadonlySet<string>
  >(() => new Set());

  const unitTypesQuery = useQuery(unitTypesByWorldQueryOptions(worldId));
  const soldiersQuery = useQuery(unitSoldiersByUnitQueryOptions(unit.id));
  const citizenIds = (soldiersQuery.data ?? []).map((s) => s.citizenId);
  const citizensQuery = useQuery(citizensByIdsQueryOptions(citizenIds));
  const levelsQuery = useQuery(educationLevelsByWorldQueryOptions(worldId));

  const renameMutation = useMutation(
    renameArmyUnitMutationOptions({ armyId, queryClient }),
  );
  const moveMutation = useMutation(
    moveArmyUnitMutationOptions({ armyId, queryClient }),
  );
  const deleteMutation = useMutation(
    deleteArmyUnitMutationOptions({ armyId, queryClient }),
  );
  const dischargeMutation = useMutation(
    dischargeSoldiersMutationOptions({
      queryClient,
      settlementId: armyStationedSettlementId,
      unitId: unit.id,
    }),
  );

  async function handleRename(name: string): Promise<void> {
    try {
      await renameMutation.mutateAsync({ name, unitId: unit.id });
      notifyMutationSuccess("Unit renamed.");
      setIsRenaming(false);
    } catch (error) {
      notifyMutationError(error, "Failed to rename unit.");
    }
  }

  async function handleMove(groupId: string | null): Promise<void> {
    try {
      await moveMutation.mutateAsync({
        groupId,
        sortOrder: 0,
        unitId: unit.id,
      });
      notifyMutationSuccess("Unit moved.");
      setIsMoving(false);
    } catch (error) {
      notifyMutationError(error, "Failed to move unit.");
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      await deleteMutation.mutateAsync({ unitId: unit.id });
      notifyMutationSuccess("Unit deleted.");
      setIsDeleting(false);
    } catch (error) {
      notifyMutationError(error, "Failed to delete unit.");
    }
  }

  async function handleDischarge(): Promise<void> {
    try {
      await dischargeMutation.mutateAsync({
        soldierIds: [...selectedSoldierIds],
      });
      notifyMutationSuccess("Soldiers discharged.");
      setSelectedSoldierIds(new Set());
      setIsDischarging(false);
    } catch (error) {
      notifyMutationError(error, "Failed to discharge soldiers.");
    }
  }

  function toggleSoldier(soldierId: string): void {
    setSelectedSoldierIds((prev) => {
      const next = new Set(prev);
      if (next.has(soldierId)) {
        next.delete(soldierId);
      } else {
        next.add(soldierId);
      }
      return next;
    });
  }

  const unitType = (unitTypesQuery.data ?? []).find(
    (type) => type.id === unit.unitTypeId,
  );
  const citizenById = new Map((citizensQuery.data ?? []).map((c) => [c.id, c]));
  const levelNameById = new Map(
    (levelsQuery.data ?? []).map((l) => [l.id, l.name]),
  );
  const soldiers = soldiersQuery.data ?? [];

  return (
    <div className="grid gap-2 border-l border-border pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <Swords aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{unit.name}</span>
        <Badge variant="outline">{unitType?.name ?? "Unknown type"}</Badge>
        <Badge variant="secondary">
          {soldiers.length}/{unitType?.soldiersPerUnit ?? "?"}
        </Badge>

        {canManage ? (
          <div className="flex flex-wrap gap-1">
            <Button
              aria-label="Rename unit"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => setIsRenaming(true)}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => setIsMoving(true)}
            >
              Move to…
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => setIsRecruiting(true)}
            >
              Recruit
            </Button>
            <Button
              disabled={selectedSoldierIds.size === 0}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => setIsDischarging(true)}
            >
              Discharge selected
            </Button>
            <Button
              aria-label="Delete unit"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => setIsDeleting(true)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>

      {soldiersQuery.isPending ||
      (citizenIds.length > 0 && citizensQuery.isPending) ? (
        <p className="text-xs text-muted-foreground">Loading roster…</p>
      ) : soldiersQuery.error !== null || citizensQuery.error !== null ? (
        <p className="text-xs text-destructive">
          {getErrorDescription(soldiersQuery.error ?? citizensQuery.error)}
        </p>
      ) : soldiers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No soldiers recruited.</p>
      ) : (
        <ul className="grid gap-1">
          {soldiers.map((soldier) => {
            const citizen = citizenById.get(soldier.citizenId);
            return (
              <li key={soldier.id} className="flex items-center gap-2 text-sm">
                {canManage ? (
                  <Checkbox
                    checked={selectedSoldierIds.has(soldier.id)}
                    onCheckedChange={() => toggleSoldier(soldier.id)}
                  />
                ) : null}
                <Link
                  className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  params={{ citizenId: soldier.citizenId, worldId }}
                  to="/worlds/$worldId/citizens/$citizenId"
                >
                  {citizen?.name ?? "Unknown citizen"}
                </Link>
                {citizen?.educationLevelId !== null &&
                citizen?.educationLevelId !== undefined ? (
                  <Badge variant="outline">
                    {levelNameById.get(citizen.educationLevelId) ?? "Unknown"}
                  </Badge>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {isRenaming ? (
        <RenameNodeDialog
          currentName={unit.name}
          isPending={renameMutation.isPending}
          title="Rename unit"
          onClose={() => setIsRenaming(false)}
          onSave={handleRename}
        />
      ) : null}
      {isMoving ? (
        <MoveNodeDialog
          armyId={armyId}
          currentGroupId={unit.groupId}
          excludedGroupIds={new Set()}
          isPending={moveMutation.isPending}
          title="Move unit"
          onClose={() => setIsMoving(false)}
          onMove={handleMove}
        />
      ) : null}
      {isRecruiting ? (
        <RecruitDialog
          armyFundingSource={armyFundingSource}
          armyStationedSettlementId={armyStationedSettlementId}
          nationId={nationId}
          queryClient={queryClient}
          unitId={unit.id}
          unitTypeId={unit.unitTypeId}
          worldId={worldId}
          onClose={() => setIsRecruiting(false)}
        />
      ) : null}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete unit</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{unit.name}"? Units must have no soldiers before they can
              be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isDischarging} onOpenChange={setIsDischarging}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discharge soldiers</AlertDialogTitle>
            <AlertDialogDescription>
              Discharge {selectedSoldierIds.size} selected soldier
              {selectedSoldierIds.size === 1 ? "" : "s"} back to civilian life?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dischargeMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={dischargeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDischarge();
              }}
            >
              Discharge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
