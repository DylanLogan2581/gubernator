import { useMutation, type QueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  createArmyGroupMutationOptions,
  createArmyUnitMutationOptions,
  deleteArmyGroupMutationOptions,
  moveArmyGroupMutationOptions,
  renameArmyGroupMutationOptions,
} from "../../mutations/armyTreeMutations";

import {
  AddUnitDialog,
  MoveNodeDialog,
  RenameNodeDialog,
} from "./TreeNodeDialogs";
import { UnitNode } from "./UnitNode";

import type {
  ArmyFundingSource,
  ArmyGroup,
  ArmyUnit,
} from "../../types/armyTypes";

export function ArmyTreeNode({
  armyFundingSource,
  armyId,
  armyStationedSettlementId,
  canManage,
  group,
  groups,
  nationId,
  queryClient,
  units,
  worldId,
}: {
  readonly armyFundingSource: ArmyFundingSource;
  readonly armyId: string;
  readonly armyStationedSettlementId: string;
  readonly canManage: boolean;
  readonly group: ArmyGroup;
  readonly groups: readonly ArmyGroup[];
  readonly nationId: string;
  readonly queryClient: QueryClient;
  readonly units: readonly ArmyUnit[];
  readonly worldId: string;
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [isAddingUnit, setIsAddingUnit] = useState(false);

  const renameMutation = useMutation(
    renameArmyGroupMutationOptions({ armyId, queryClient }),
  );
  const moveMutation = useMutation(
    moveArmyGroupMutationOptions({ armyId, queryClient }),
  );
  const deleteMutation = useMutation(
    deleteArmyGroupMutationOptions({ armyId, queryClient }),
  );
  const createGroupMutation = useMutation(
    createArmyGroupMutationOptions({ armyId, queryClient }),
  );
  const createUnitMutation = useMutation(
    createArmyUnitMutationOptions({ armyId, queryClient }),
  );

  async function handleRename(name: string): Promise<void> {
    try {
      await renameMutation.mutateAsync({ groupId: group.id, name });
      notifyMutationSuccess("Group renamed.");
      setIsRenaming(false);
    } catch (error) {
      notifyMutationError(error, "Failed to rename group.");
    }
  }

  async function handleMove(newParentGroupId: string | null): Promise<void> {
    try {
      await moveMutation.mutateAsync({ groupId: group.id, newParentGroupId });
      notifyMutationSuccess("Group moved.");
      setIsMoving(false);
    } catch (error) {
      notifyMutationError(error, "Failed to move group.");
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      await deleteMutation.mutateAsync({ groupId: group.id });
      notifyMutationSuccess("Group deleted.");
      setIsDeleting(false);
    } catch (error) {
      notifyMutationError(error, "Failed to delete group.");
    }
  }

  async function handleAddGroup(name: string): Promise<void> {
    try {
      await createGroupMutation.mutateAsync({
        armyId,
        name,
        parentGroupId: group.id,
      });
      notifyMutationSuccess("Group added.");
      setIsAddingGroup(false);
    } catch (error) {
      notifyMutationError(error, "Failed to add group.");
    }
  }

  async function handleAddUnit(
    name: string,
    unitTypeId: string,
  ): Promise<void> {
    try {
      await createUnitMutation.mutateAsync({
        armyId,
        groupId: group.id,
        name,
        unitTypeId,
      });
      notifyMutationSuccess("Unit added.");
      setIsAddingUnit(false);
    } catch (error) {
      notifyMutationError(error, "Failed to add unit.");
    }
  }

  const childGroups = groups.filter((g) => g.parentGroupId === group.id);
  const childUnits = units.filter((u) => u.groupId === group.id);
  const excludedGroupIds = collectDescendantGroupIds(groups, group.id);

  return (
    <div className="grid gap-1 border-l border-border pl-3">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex flex-wrap items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button
              aria-label={isExpanded ? "Collapse group" : "Expand group"}
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
          <span className="text-sm font-medium">{group.name}</span>

          {canManage ? (
            <div className="flex flex-wrap gap-1">
              <Button
                aria-label="Rename group"
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
                onClick={() => setIsAddingGroup(true)}
              >
                <Plus aria-hidden="true" /> Group
              </Button>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => setIsAddingUnit(true)}
              >
                <Plus aria-hidden="true" /> Unit
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
                aria-label="Delete group"
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
          {childGroups.length === 0 && childUnits.length === 0 ? (
            <p className="text-xs text-muted-foreground">Empty group.</p>
          ) : (
            <>
              {childGroups.map((childGroup) => (
                <ArmyTreeNode
                  key={childGroup.id}
                  armyFundingSource={armyFundingSource}
                  armyId={armyId}
                  armyStationedSettlementId={armyStationedSettlementId}
                  canManage={canManage}
                  group={childGroup}
                  groups={groups}
                  nationId={nationId}
                  queryClient={queryClient}
                  units={units}
                  worldId={worldId}
                />
              ))}
              {childUnits.map((unit) => (
                <UnitNode
                  key={unit.id}
                  armyFundingSource={armyFundingSource}
                  armyId={armyId}
                  armyStationedSettlementId={armyStationedSettlementId}
                  canManage={canManage}
                  nationId={nationId}
                  queryClient={queryClient}
                  unit={unit}
                  worldId={worldId}
                />
              ))}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {isRenaming ? (
        <RenameNodeDialog
          currentName={group.name}
          isPending={renameMutation.isPending}
          title="Rename group"
          onClose={() => setIsRenaming(false)}
          onSave={handleRename}
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
      {isAddingUnit ? (
        <AddUnitDialog
          isPending={createUnitMutation.isPending}
          worldId={worldId}
          onClose={() => setIsAddingUnit(false)}
          onCreate={handleAddUnit}
        />
      ) : null}
      {isMoving ? (
        <MoveNodeDialog
          armyId={armyId}
          currentGroupId={group.parentGroupId}
          excludedGroupIds={excludedGroupIds}
          isPending={moveMutation.isPending}
          title="Move group"
          onClose={() => setIsMoving(false)}
          onMove={handleMove}
        />
      ) : null}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{group.name}"? Groups with child groups or units cannot be
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
    </div>
  );
}

function collectDescendantGroupIds(
  groups: readonly ArmyGroup[],
  rootId: string,
): ReadonlySet<string> {
  const ids = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const group of groups) {
      if (
        group.parentGroupId !== null &&
        ids.has(group.parentGroupId) &&
        !ids.has(group.id)
      ) {
        ids.add(group.id);
        added = true;
      }
    }
  }
  return ids;
}
