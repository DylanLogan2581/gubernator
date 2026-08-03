import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState, type JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { citizensInSettlementQueryOptions } from "@/features/citizens";
import {
  educationLevelsByWorldQueryOptions,
  settlementEnrolledCitizenIdsQueryOptions,
} from "@/features/education";
import {
  nationOfficesRosterQueryOptions,
  nationSettlementsQueryOptions,
  nationStockpileQueryOptions,
} from "@/features/nations";
import { settlementStockpilesByIdQueryOptions } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { recruitSoldiersMutationOptions } from "../../mutations/recruitmentMutations";
import {
  soldierCitizenIdsByWorldQueryOptions,
  unitSoldiersByUnitQueryOptions,
} from "../../queries/armiesQueries";
import { unitTypesByWorldQueryOptions } from "../../queries/unitTypesQueries";
import {
  classifyRecruitCandidate,
  computeRecruitCostShortfalls,
  formatRecruitIneligibilityReason,
} from "../../utils/recruitEligibility";

import type { ArmyFundingSource } from "../../types/armyTypes";

export function RecruitDialog({
  armyFundingSource,
  armyStationedSettlementId,
  nationId,
  onClose,
  queryClient,
  unitId,
  unitTypeId,
  worldId,
}: {
  readonly armyFundingSource: ArmyFundingSource;
  readonly armyStationedSettlementId: string;
  readonly nationId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly unitId: string;
  readonly unitTypeId: string;
  readonly worldId: string;
}): JSX.Element {
  const settlementSelectId = useId();
  const [settlementId, setSettlementId] = useState(armyStationedSettlementId);
  const [selectedCitizenIds, setSelectedCitizenIds] = useState<
    ReadonlySet<string>
  >(() => new Set());

  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nationId));
  const citizensQuery = useQuery(
    citizensInSettlementQueryOptions(settlementId),
  );
  const enrolledIdsQuery = useQuery(
    settlementEnrolledCitizenIdsQueryOptions(settlementId),
  );
  const officesQuery = useQuery(nationOfficesRosterQueryOptions(nationId));
  const levelsQuery = useQuery(educationLevelsByWorldQueryOptions(worldId));
  const unitTypesQuery = useQuery(unitTypesByWorldQueryOptions(worldId));
  const currentSoldiersQuery = useQuery(unitSoldiersByUnitQueryOptions(unitId));
  const soldierCitizenIdsQuery = useQuery(
    soldierCitizenIdsByWorldQueryOptions(worldId),
  );
  const nationStockpileQuery = useQuery({
    ...nationStockpileQueryOptions(nationId),
    enabled: armyFundingSource === "nation",
  });
  const settlementStockpileQuery = useQuery({
    ...settlementStockpilesByIdQueryOptions(armyStationedSettlementId),
    enabled: armyFundingSource === "host_settlement",
  });

  const recruitMutation = useMutation(
    recruitSoldiersMutationOptions({ queryClient }),
  );

  const isLoading =
    settlementsQuery.isPending ||
    citizensQuery.isPending ||
    enrolledIdsQuery.isPending ||
    officesQuery.isPending ||
    levelsQuery.isPending ||
    unitTypesQuery.isPending ||
    currentSoldiersQuery.isPending ||
    soldierCitizenIdsQuery.isPending;
  const loadError =
    settlementsQuery.error ??
    citizensQuery.error ??
    enrolledIdsQuery.error ??
    officesQuery.error ??
    levelsQuery.error ??
    unitTypesQuery.error ??
    currentSoldiersQuery.error ??
    soldierCitizenIdsQuery.error;

  const unitType = (unitTypesQuery.data ?? []).find(
    (type) => type.id === unitTypeId,
  );
  const levelRankById = useMemo(
    () => new Map((levelsQuery.data ?? []).map((l) => [l.id, l.rank])),
    [levelsQuery.data],
  );
  const levelNameById = useMemo(
    () => new Map((levelsQuery.data ?? []).map((l) => [l.id, l.name])),
    [levelsQuery.data],
  );
  const officeholderCitizenIds = useMemo(
    () => new Set((officesQuery.data ?? []).map((o) => o.citizenId)),
    [officesQuery.data],
  );
  const enrolledCitizenIds = useMemo(
    () => new Set(enrolledIdsQuery.data ?? []),
    [enrolledIdsQuery.data],
  );

  const classified = (citizensQuery.data ?? []).map((citizen) => ({
    citizen,
    reasons: classifyRecruitCandidate({
      citizen,
      enrolledCitizenIds,
      levelRankById,
      officeholderCitizenIds,
      requiredEducationLevelId: unitType?.requiredEducationLevelId ?? null,
      soldierCitizenIds: soldierCitizenIdsQuery.data ?? new Set<string>(),
      targetSettlementId: settlementId,
    }),
  }));

  const currentSoldierCount = currentSoldiersQuery.data?.length ?? 0;
  const selectedCount = selectedCitizenIds.size;
  const capacityExceeded =
    unitType !== undefined &&
    currentSoldierCount + selectedCount > unitType.soldiersPerUnit;

  const availableByResourceId = useMemo(() => {
    const rows =
      armyFundingSource === "nation"
        ? (nationStockpileQuery.data ?? []).map((r) => ({
            quantity: r.quantity,
            resourceId: r.resourceId,
          }))
        : (settlementStockpileQuery.data ?? []).map((r) => ({
            quantity: r.quantity,
            resourceId: r.resourceId,
          }));
    return new Map(rows.map((r) => [r.resourceId, r.quantity]));
  }, [
    armyFundingSource,
    nationStockpileQuery.data,
    settlementStockpileQuery.data,
  ]);

  const shortfalls = computeRecruitCostShortfalls({
    availableByResourceId,
    costs: unitType?.recruitmentCostsJson ?? [],
    selectedCount,
  });

  function toggleCitizen(citizenId: string): void {
    setSelectedCitizenIds((prev) => {
      const next = new Set(prev);
      if (next.has(citizenId)) {
        next.delete(citizenId);
      } else {
        next.add(citizenId);
      }
      return next;
    });
  }

  async function handleRecruit(): Promise<void> {
    if (selectedCitizenIds.size === 0) return;
    try {
      await recruitMutation.mutateAsync({
        citizenIds: [...selectedCitizenIds],
        settlementId,
        unitId,
      });
      notifyMutationSuccess("Soldiers recruited.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to recruit soldiers.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recruit soldiers</DialogTitle>
          <DialogDescription>
            Select a settlement of residence, then choose eligible citizens to
            recruit into this unit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor={settlementSelectId}>Settlement</Label>
          <NativeSelect
            id={settlementSelectId}
            value={settlementId}
            onChange={(e) => {
              setSettlementId(e.target.value);
              setSelectedCitizenIds(new Set());
            }}
          >
            {(settlementsQuery.data ?? []).map((settlement) => (
              <option key={settlement.id} value={settlement.id}>
                {settlement.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading citizens…</p>
        ) : loadError !== null ? (
          <p className="text-sm text-destructive">
            {getErrorDescription(loadError)}
          </p>
        ) : (
          <div className="grid gap-2">
            {unitType !== undefined ? (
              <p className="text-xs text-muted-foreground">
                Capacity: {currentSoldierCount + selectedCount}/
                {unitType.soldiersPerUnit}
                {capacityExceeded ? (
                  <span className="ml-1 text-destructive">
                    Exceeds unit capacity.
                  </span>
                ) : null}
              </p>
            ) : null}

            <ul className="grid max-h-64 gap-1 overflow-y-auto">
              {classified.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  No citizens live in this settlement.
                </li>
              ) : (
                classified.map(({ citizen, reasons }) => {
                  const isEligible = reasons.length === 0;
                  const isChecked = selectedCitizenIds.has(citizen.id);
                  return (
                    <li
                      key={citizen.id}
                      className="flex items-start gap-2 rounded-md px-1 py-1 text-sm"
                    >
                      <Checkbox
                        checked={isChecked}
                        disabled={!isEligible}
                        onCheckedChange={() => toggleCitizen(citizen.id)}
                      />
                      <span
                        className={!isEligible ? "text-muted-foreground" : ""}
                      >
                        {citizen.name}
                        {!isEligible ? (
                          <span className="block text-xs">
                            {reasons
                              .map((reason) =>
                                formatRecruitIneligibilityReason(
                                  reason,
                                  unitType?.requiredEducationLevelId !== null &&
                                    unitType?.requiredEducationLevelId !==
                                      undefined
                                    ? levelNameById.get(
                                        unitType.requiredEducationLevelId,
                                      )
                                    : undefined,
                                ),
                              )
                              .join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>

            {shortfalls.length > 0 ? (
              <Alert variant="destructive">
                <AlertTitle>Insufficient resources</AlertTitle>
                <AlertDescription>
                  <ul className="grid gap-0.5">
                    {shortfalls.map((shortfall) => (
                      <li key={shortfall.resourceId}>
                        Short {shortfall.shortfall} of resource{" "}
                        {shortfall.resourceId}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            {selectedCount > 0 ? (
              <Badge className="w-fit" variant="outline">
                {selectedCount} selected
              </Badge>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={recruitMutation.isPending}
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={recruitMutation.isPending || selectedCount === 0}
            type="button"
            onClick={() => void handleRecruit()}
          >
            Recruit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
