import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { deleteArmyMutationOptions } from "../../mutations/armiesMutations";
import { createArmyGroupMutationOptions } from "../../mutations/armyTreeMutations";
import {
  armyGroupsByArmyQueryOptions,
  armyUnitsByArmyQueryOptions,
} from "../../queries/armiesQueries";
import {
  formatArmyFundingSource,
  type Army,
  type ArmyTurnSnapshot,
} from "../../types/armyTypes";

import { MoveArmyDialog, RenameArmyDialog } from "./ArmyActionDialogs";
import { ArmyTreeNode } from "./ArmyTreeNode";
import { RenameNodeDialog } from "./TreeNodeDialogs";
import { UnitNode } from "./UnitNode";

export function ArmyCard({
  army,
  canManage,
  nationId,
  queryClient,
  settlementNameById,
  soldierCount,
  latestSnapshot,
  worldId,
}: {
  readonly army: Army;
  readonly canManage: boolean;
  readonly latestSnapshot: ArmyTurnSnapshot | undefined;
  readonly nationId: string;
  readonly queryClient: QueryClient;
  readonly settlementNameById: ReadonlyMap<string, string>;
  readonly soldierCount: number;
  readonly worldId: string;
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  const groupsQuery = useQuery({
    ...armyGroupsByArmyQueryOptions(army.id),
    enabled: isExpanded,
  });
  const unitsQuery = useQuery({
    ...armyUnitsByArmyQueryOptions(army.id),
    enabled: isExpanded,
  });

  const deleteMutation = useMutation(
    deleteArmyMutationOptions({ queryClient }),
  );
  const createGroupMutation = useMutation(
    createArmyGroupMutationOptions({ armyId: army.id, queryClient }),
  );

  async function handleDelete(): Promise<void> {
    try {
      await deleteMutation.mutateAsync({ armyId: army.id });
      notifyMutationSuccess("Army deleted.");
      setIsDeleting(false);
    } catch (error) {
      notifyMutationError(error, "Failed to delete army.");
    }
  }

  async function handleAddGroup(name: string): Promise<void> {
    try {
      await createGroupMutation.mutateAsync({
        armyId: army.id,
        name,
        parentGroupId: null,
      });
      notifyMutationSuccess("Group added.");
      setIsAddingGroup(false);
    } catch (error) {
      notifyMutationError(error, "Failed to add group.");
    }
  }

  const groups = groupsQuery.data ?? [];
  const units = unitsQuery.data ?? [];
  const rootGroups = groups.filter((g) => g.parentGroupId === null);
  const rootUnits = units.filter((u) => u.groupId === null);
  const settlementName =
    settlementNameById.get(army.stationedSettlementId) ?? "Unknown settlement";

  return (
    <Card>
      <CardContent className="grid gap-3">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button
                  aria-label={isExpanded ? "Collapse army" : "Expand army"}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={
                      isExpanded
                        ? "rotate-180 transition-transform"
                        : "transition-transform"
                    }
                  />
                </Button>
              </CollapsibleTrigger>
              <h3 className="text-sm font-medium">{army.name}</h3>
              <Badge variant="outline">{settlementName}</Badge>
              <Badge variant="outline">
                {formatArmyFundingSource(army.fundingSource)}
              </Badge>
              <Badge variant="secondary">{soldierCount} soldiers</Badge>
              {latestSnapshot !== undefined ? (
                <Badge
                  variant={
                    latestSnapshot.upkeepPaid ? "success" : "destructive"
                  }
                >
                  {latestSnapshot.upkeepPaid ? "Upkeep paid" : "Upkeep unpaid"}
                </Badge>
              ) : null}
            </div>

            {canManage ? (
              <div className="flex flex-wrap gap-1">
                <Button
                  aria-label="Rename army"
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
                  Move
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingGroup(true)}
                >
                  <Plus aria-hidden="true" /> Add group
                </Button>
                <Button
                  aria-label="Delete army"
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

          <CollapsibleContent className="grid gap-2 pt-2">
            {groupsQuery.isPending || unitsQuery.isPending ? (
              <p className="text-xs text-muted-foreground">
                Loading army tree…
              </p>
            ) : groupsQuery.error !== null || unitsQuery.error !== null ? (
              <p className="text-xs text-destructive">
                {getErrorDescription(groupsQuery.error ?? unitsQuery.error)}
              </p>
            ) : rootGroups.length === 0 && rootUnits.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                This army has no groups or units yet.
              </p>
            ) : (
              <div className="grid gap-2">
                {rootGroups.map((group) => (
                  <ArmyTreeNode
                    key={group.id}
                    armyFundingSource={army.fundingSource}
                    armyId={army.id}
                    armyStationedSettlementId={army.stationedSettlementId}
                    canManage={canManage}
                    group={group}
                    groups={groups}
                    nationId={nationId}
                    queryClient={queryClient}
                    units={units}
                    worldId={worldId}
                  />
                ))}
                {rootUnits.map((unit) => (
                  <UnitNode
                    key={unit.id}
                    armyFundingSource={army.fundingSource}
                    armyId={army.id}
                    armyStationedSettlementId={army.stationedSettlementId}
                    canManage={canManage}
                    nationId={nationId}
                    queryClient={queryClient}
                    unit={unit}
                    worldId={worldId}
                  />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {isRenaming ? (
        <RenameArmyDialog
          armyId={army.id}
          currentName={army.name}
          nationId={nationId}
          queryClient={queryClient}
          onClose={() => setIsRenaming(false)}
        />
      ) : null}
      {isMoving ? (
        <MoveArmyDialog
          armyId={army.id}
          currentSettlementId={army.stationedSettlementId}
          nationId={nationId}
          queryClient={queryClient}
          onClose={() => setIsMoving(false)}
        />
      ) : null}
      {isAddingGroup ? (
        <RenameNodeDialog
          currentName=""
          isPending={createGroupMutation.isPending}
          title="Add group"
          onClose={() => setIsAddingGroup(false)}
          onSave={handleAddGroup}
        />
      ) : null}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete army</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{army.name}"? Armies with groups or units cannot be
              deleted until they are removed first.
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
    </Card>
  );
}
