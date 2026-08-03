import { useQuery } from "@tanstack/react-query";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { activeDepositTypesByWorldQueryOptions } from "@/features/deposits";
import type { DepositType } from "@/features/deposits";

import {
  useDepositsInScope,
  type DepositWithLocationInfo,
} from "../../../hooks/useDepositsInScope";

import { ZeroTargetAlert } from "./Shared";

import type { EffectEditorProps } from "./Types";
import type { JSX } from "react";

/** Editor for the deposit_destroyed effect. */
export function DepositDestroyedEditor({
  effect,
  index,
  onUpdate,
  worldId,
  selectedIds,
  scopeType,
}: EffectEditorProps): JSX.Element {
  const { deposits: allDeposits, isLoading: depositsLoading } =
    useDepositsInScope({ worldId, scopeType, selectedIds });

  const depositTypesQuery = useQuery(
    activeDepositTypesByWorldQueryOptions(worldId),
  );

  // Live count of deposits currently matching the selected type in scope, used
  // both for the zero-target warning and the "All <type> deposits" summary.
  const matchingDepositCount =
    effect.depositDestroyedMode === "type" &&
    effect.depositTypeId !== null &&
    effect.depositTypeId !== undefined
      ? allDeposits.filter((d) => d.depositTypeId === effect.depositTypeId)
          .length
      : undefined;

  return (
    <>
      <ZeroTargetAlert
        effect={effect}
        worldId={worldId}
        scopeType={scopeType}
        selectedIds={selectedIds}
        matchingDepositCount={matchingDepositCount}
      />

      <div className="space-y-2">
        <Label>Deposits to Destroy</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={effect.depositDestroyedMode !== "type"}
              onChange={() =>
                onUpdate({
                  ...effect,
                  depositDestroyedMode: "instance",
                  depositTypeId: null,
                })
              }
            />
            <span className="text-sm">Specific deposits</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={effect.depositDestroyedMode === "type"}
              onChange={() =>
                onUpdate({
                  ...effect,
                  depositDestroyedMode: "type",
                  depositInstanceId: null,
                  depositInstanceIds: undefined,
                })
              }
            />
            <span className="text-sm">All of a deposit type in scope</span>
          </label>
        </div>

        {effect.depositDestroyedMode === "type" ? (
          <div className="space-y-2">
            <Label htmlFor={`deposit-type-select-${index}`}>
              Select Deposit Type
            </Label>
            {depositTypesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading deposit types...
              </p>
            ) : depositTypesQuery.data === undefined ||
              depositTypesQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No deposit types available
              </p>
            ) : (
              <Select
                value={effect.depositTypeId ?? ""}
                onValueChange={(value) =>
                  onUpdate({
                    ...effect,
                    depositTypeId: value !== "" ? value : null,
                  })
                }
              >
                <SelectTrigger id={`deposit-type-select-${index}`}>
                  <SelectValue placeholder="Choose a deposit type" />
                </SelectTrigger>
                <SelectContent>
                  {depositTypesQuery.data.map((type: DepositType) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {effect.depositTypeId !== null &&
              effect.depositTypeId !== undefined &&
              scopeType !== null && (
                <p className="text-sm text-muted-foreground">
                  {depositsLoading
                    ? "Loading matching deposits..."
                    : `Currently ${matchingDepositCount ?? 0} matching deposit${
                        (matchingDepositCount ?? 0) === 1 ? "" : "s"
                      } in scope`}
                </p>
              )}
          </div>
        ) : scopeType === null ? (
          <p className="text-sm text-muted-foreground">
            Select a scope in step 1 to target deposits
          </p>
        ) : selectedIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {scopeType === "settlement"
              ? "No settlements selected"
              : scopeType === "nation"
                ? "No nations selected"
                : "No world selected"}
          </p>
        ) : allDeposits.length === 0 && depositsLoading ? (
          <p className="text-sm text-muted-foreground">Loading deposits...</p>
        ) : allDeposits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No deposits available in selected {scopeType}
          </p>
        ) : (
          <div className="space-y-2 rounded-md border p-3 max-h-64 overflow-y-auto">
            {/* Group deposits by settlement for clarity at scale */}
            {Object.entries(
              allDeposits.reduce(
                (acc, deposit) => {
                  const group = deposit.groupLabel;
                  if (!(group in acc)) acc[group] = [];
                  acc[group].push(deposit);
                  return acc;
                },
                {} as Record<string, DepositWithLocationInfo[]>,
              ),
            ).map(([group, groupDeposits]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  {group}
                </p>
                <div className="space-y-2 ml-2">
                  {groupDeposits.map((deposit) => (
                    <label key={deposit.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={
                          effect.depositInstanceIds?.includes(deposit.id) ??
                          effect.depositInstanceId === deposit.id
                        }
                        onCheckedChange={(checked) => {
                          const currentIds =
                            effect.depositInstanceIds ??
                            (effect.depositInstanceId !== null
                              ? [effect.depositInstanceId]
                              : []);
                          const newIds = new Set(currentIds);
                          if (checked === true) {
                            newIds.add(deposit.id);
                          } else if (checked === false) {
                            newIds.delete(deposit.id);
                          }
                          onUpdate({
                            ...effect,
                            depositInstanceIds: Array.from(newIds),
                          });
                        }}
                      />
                      <span className="text-sm">{deposit.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
