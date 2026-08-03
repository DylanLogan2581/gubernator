import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNationManageAuthority } from "@/features/permissions";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import type { Resource } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { generateLocalId } from "@/lib/uid";

import {
  deleteNationTaxPolicyMutationOptions,
  demandTributeMutationOptions,
  upsertNationTaxPolicyMutationOptions,
} from "../../mutations/taxPolicyMutations";
import { nationSettlementsQueryOptions } from "../../queries/nationsQueries";
import { nationTaxPoliciesQueryOptions } from "../../queries/taxPolicyQueries";

import type { UpsertNationTaxPolicyInput } from "../../schemas/taxPolicySchemas";
import type { Nation, NationSettlement } from "../../types/nationTypes";
import type { NationTaxPolicy, TaxMethod } from "../../types/taxPolicyTypes";

const TAX_METHOD_OPTIONS: readonly { label: string; value: TaxMethod }[] = [
  { label: "Percent of production", value: "percent_production" },
  { label: "Percent of stockpile", value: "percent_stockpile" },
  { label: "Flat amount per resource", value: "flat" },
];

function isPercentMethod(method: TaxMethod): boolean {
  return method === "percent_production" || method === "percent_stockpile";
}

export function NationTaxPolicySection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const { canManageNation: canManage } = useNationManageAuthority({
    canAdmin: canAdminWorld,
    nationId: nation.id,
  });

  const queryClient = useQueryClient();
  const policiesQuery = useQuery(nationTaxPoliciesQueryOptions(nation.id));
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nation.id));
  const resourcesQuery = useQuery(
    activeResourcesByWorldQueryOptions(nation.worldId),
  );

  const [isDemandingTribute, setIsDemandingTribute] = useState(false);

  const canEdit = canManage && !isArchived;

  const policies = policiesQuery.data ?? [];
  const resources = resourcesQuery.data ?? [];
  const defaultPolicy =
    policies.find((policy) => policy.settlementId === null) ?? null;
  const overridesBySettlement = new Map(
    policies
      .filter((policy) => policy.settlementId !== null)
      .map((policy) => [policy.settlementId as string, policy]),
  );

  return (
    <Card
      aria-labelledby="nation-tax-policy-heading"
      className="grid gap-4 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="nation-tax-policy-heading" className="text-base font-medium">
          Tax policy
        </h2>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsDemandingTribute(true)}
          >
            Demand tribute
          </Button>
        ) : null}
      </div>

      {policiesQuery.isPending || resourcesQuery.isPending ? (
        <LoadingState label="Loading tax policy…" />
      ) : policiesQuery.isError ? (
        <ErrorState
          title="Tax policy could not be loaded"
          description={getErrorDescription(policiesQuery.error)}
        />
      ) : resourcesQuery.isError ? (
        <ErrorState
          title="Resources could not be loaded"
          description={getErrorDescription(resourcesQuery.error)}
        />
      ) : (
        <>
          <section className="grid gap-2">
            <h3 className="text-sm font-medium">Default rule</h3>
            <p className="text-xs text-muted-foreground">
              Applies to every settlement in this nation that does not have its
              own override.
            </p>
            <DefaultRuleEditor
              canEdit={canEdit}
              key={defaultPolicy?.id ?? "none"}
              nation={nation}
              policy={defaultPolicy}
              queryClient={queryClient}
              resources={resources}
            />
          </section>

          <SettlementOverridesSection
            canEdit={canEdit}
            error={settlementsQuery.error}
            isError={settlementsQuery.isError}
            isPending={settlementsQuery.isPending}
            nation={nation}
            overridesBySettlement={overridesBySettlement}
            queryClient={queryClient}
            resources={resources}
            settlements={settlementsQuery.data ?? []}
          />
        </>
      )}

      {isDemandingTribute ? (
        <DemandTributeDialog
          nation={nation}
          onClose={() => setIsDemandingTribute(false)}
          queryClient={queryClient}
          resources={resources}
          settlements={settlementsQuery.data ?? []}
        />
      ) : null}
    </Card>
  );
}

type TaxPolicyFormState = {
  readonly exempt: boolean;
  readonly flatAmount: string;
  readonly method: TaxMethod;
  readonly minStockpileFloor: string;
  readonly ratePercent: string;
  readonly scope: "all" | "specific";
  readonly selectedResourceIds: ReadonlySet<string>;
};

function initialFormState(policy: NationTaxPolicy | null): TaxPolicyFormState {
  if (policy === null) {
    return {
      exempt: false,
      flatAmount: "0",
      method: "percent_production",
      minStockpileFloor: "0",
      ratePercent: "0",
      scope: "all",
      selectedResourceIds: new Set(),
    };
  }
  return {
    exempt: policy.exempt,
    flatAmount: String(policy.flatAmount),
    method: policy.method,
    minStockpileFloor: String(policy.minStockpileFloor),
    ratePercent: String(Math.round(policy.rate * 100)),
    scope: policy.taxedResourceIds === null ? "all" : "specific",
    selectedResourceIds: new Set(policy.taxedResourceIds ?? []),
  };
}

function buildPolicyValues(
  state: TaxPolicyFormState,
  base: { readonly nationId: string; readonly settlementId: string | null },
): UpsertNationTaxPolicyInput {
  const percentMethod = isPercentMethod(state.method);
  return {
    exempt: state.exempt,
    flatAmount: state.method === "flat" ? Number(state.flatAmount) : 0,
    method: state.method,
    minStockpileFloor: Number(state.minStockpileFloor),
    nationId: base.nationId,
    rate: percentMethod ? Number(state.ratePercent) / 100 : 0,
    settlementId: base.settlementId,
    taxedResourceIds:
      state.scope === "all" ? null : [...state.selectedResourceIds],
  };
}

function isFormValid(state: TaxPolicyFormState): boolean {
  const floor = Number(state.minStockpileFloor);
  if (!Number.isFinite(floor) || floor < 0) return false;
  if (isPercentMethod(state.method)) {
    const percent = Number(state.ratePercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return false;
  } else {
    const flat = Number(state.flatAmount);
    if (!Number.isFinite(flat) || flat < 0) return false;
  }
  return true;
}

function TaxPolicyFields({
  disabled,
  idPrefix,
  resources,
  setState,
  state,
}: {
  readonly disabled: boolean;
  readonly idPrefix: string;
  readonly resources: readonly Resource[];
  readonly setState: (
    updater: (prev: TaxPolicyFormState) => TaxPolicyFormState,
  ) => void;
  readonly state: TaxPolicyFormState;
}): JSX.Element {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor={`${idPrefix}-method`}>Method</Label>
        <Select
          value={state.method}
          onValueChange={(value) =>
            setState((prev) => ({ ...prev, method: value as TaxMethod }))
          }
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-method`} aria-label="Method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAX_METHOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPercentMethod(state.method) ? (
        <div className="grid gap-1">
          <Label htmlFor={`${idPrefix}-rate`}>Rate (%)</Label>
          <Input
            id={`${idPrefix}-rate`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={state.ratePercent}
            disabled={disabled}
            onChange={(event) =>
              setState((prev) => ({ ...prev, ratePercent: event.target.value }))
            }
          />
        </div>
      ) : (
        <div className="grid gap-1">
          <Label htmlFor={`${idPrefix}-flat`}>Flat amount per resource</Label>
          <Input
            id={`${idPrefix}-flat`}
            type="number"
            min={0}
            step={1}
            value={state.flatAmount}
            disabled={disabled}
            onChange={(event) =>
              setState((prev) => ({ ...prev, flatAmount: event.target.value }))
            }
          />
        </div>
      )}

      <div className="grid gap-1">
        <Label htmlFor={`${idPrefix}-floor`}>Minimum stockpile floor</Label>
        <Input
          id={`${idPrefix}-floor`}
          type="number"
          min={0}
          step={1}
          value={state.minStockpileFloor}
          disabled={disabled}
          onChange={(event) =>
            setState((prev) => ({
              ...prev,
              minStockpileFloor: event.target.value,
            }))
          }
        />
        <p className="text-xs text-muted-foreground">
          A settlement is never taxed below this quantity of a resource.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${idPrefix}-exempt`}>Exempt from taxation</Label>
        <Switch
          id={`${idPrefix}-exempt`}
          checked={state.exempt}
          disabled={disabled}
          onCheckedChange={(checked) =>
            setState((prev) => ({ ...prev, exempt: checked }))
          }
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-scope`}>Taxed resources</Label>
        <Select
          value={state.scope}
          onValueChange={(value) =>
            setState((prev) => ({
              ...prev,
              scope: value as "all" | "specific",
            }))
          }
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-scope`} aria-label="Taxed resources">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            <SelectItem value="specific">Specific resources</SelectItem>
          </SelectContent>
        </Select>
        {state.scope === "specific" ? (
          <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2">
            {resources.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No resources are defined in this world yet.
              </p>
            ) : (
              resources.map((resource) => {
                const checkboxId = `${idPrefix}-res-${resource.id}`;
                return (
                  <div
                    key={resource.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={state.selectedResourceIds.has(resource.id)}
                      disabled={disabled}
                      onCheckedChange={(checked) =>
                        setState((prev) => {
                          const next = new Set(prev.selectedResourceIds);
                          if (checked === true) {
                            next.add(resource.id);
                          } else {
                            next.delete(resource.id);
                          }
                          return { ...prev, selectedResourceIds: next };
                        })
                      }
                    />
                    <Label htmlFor={checkboxId} className="font-normal">
                      {resource.name}
                    </Label>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
        {state.scope === "specific" && state.selectedResourceIds.size === 0 ? (
          <p className="text-xs text-muted-foreground">
            No resources selected — nothing will be taxed under this rule.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DefaultRuleEditor({
  canEdit,
  nation,
  policy,
  queryClient,
  resources,
}: {
  readonly canEdit: boolean;
  readonly nation: Nation;
  readonly policy: NationTaxPolicy | null;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly resources: readonly Resource[];
}): JSX.Element {
  const [state, setState] = useState<TaxPolicyFormState>(() =>
    initialFormState(policy),
  );
  const upsertMutation = useMutation(
    upsertNationTaxPolicyMutationOptions({ queryClient }),
  );

  function handleSave(): void {
    if (!isFormValid(state)) return;
    upsertMutation.mutate(
      buildPolicyValues(state, { nationId: nation.id, settlementId: null }),
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to save default tax rule.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Default tax rule saved.");
        },
      },
    );
  }

  return (
    <div className="grid gap-3">
      <TaxPolicyFields
        disabled={!canEdit}
        idPrefix="tax-default"
        resources={resources}
        setState={setState}
        state={state}
      />
      {canEdit ? (
        <Button
          type="button"
          size="sm"
          className="justify-self-start"
          disabled={upsertMutation.isPending || !isFormValid(state)}
          onClick={handleSave}
        >
          {upsertMutation.isPending ? "Saving…" : "Save default rule"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          You do not have permission to edit this nation's tax policy.
        </p>
      )}
    </div>
  );
}

function SettlementOverridesSection({
  canEdit,
  error,
  isError,
  isPending,
  nation,
  overridesBySettlement,
  queryClient,
  resources,
  settlements,
}: {
  readonly canEdit: boolean;
  readonly error: unknown;
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly nation: Nation;
  readonly overridesBySettlement: ReadonlyMap<string, NationTaxPolicy>;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly resources: readonly Resource[];
  readonly settlements: readonly NationSettlement[];
}): JSX.Element {
  const [editing, setEditing] = useState<NationSettlement | null>(null);
  const deleteMutation = useMutation(
    deleteNationTaxPolicyMutationOptions({ queryClient }),
  );

  function handleRemove(settlementId: string): void {
    deleteMutation.mutate(
      { nationId: nation.id, settlementId },
      {
        onError: (mutationError) => {
          notifyMutationError(mutationError, "Failed to remove override.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Settlement override removed.");
        },
      },
    );
  }

  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-medium">Per-settlement overrides</h3>
      {isPending ? (
        <LoadingState label="Loading settlements…" />
      ) : isError ? (
        <ErrorState
          title="Settlements could not be loaded"
          description={getErrorDescription(error)}
        />
      ) : settlements.length === 0 ? (
        <EmptyState
          title="No settlements"
          description="This nation has no settlements to override yet."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Settlement</TableHead>
              <TableHead scope="col">Rule</TableHead>
              <TableHead scope="col" className="text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.map((settlement) => {
              const override = overridesBySettlement.get(settlement.id) ?? null;
              return (
                <TableRow key={settlement.id}>
                  <TableCell>{settlement.name}</TableCell>
                  <TableCell>
                    {override === null ? (
                      <Badge variant="outline">Uses default</Badge>
                    ) : (
                      <Badge>{describePolicy(override)}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(settlement)}
                        >
                          {override === null ? "Add override" : "Edit"}
                        </Button>
                        {override !== null ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleRemove(settlement.id)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {editing !== null ? (
        <SettlementOverrideDialog
          nation={nation}
          onClose={() => setEditing(null)}
          policy={overridesBySettlement.get(editing.id) ?? null}
          queryClient={queryClient}
          resources={resources}
          settlement={editing}
        />
      ) : null}
    </section>
  );
}

function describePolicy(policy: NationTaxPolicy): string {
  if (policy.exempt) return "Exempt";
  if (isPercentMethod(policy.method)) {
    return `${Math.round(policy.rate * 100)}% ${
      policy.method === "percent_production" ? "production" : "stockpile"
    }`;
  }
  return `Flat ${policy.flatAmount.toLocaleString()}`;
}

function SettlementOverrideDialog({
  nation,
  onClose,
  policy,
  queryClient,
  resources,
  settlement,
}: {
  readonly nation: Nation;
  readonly onClose: () => void;
  readonly policy: NationTaxPolicy | null;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly resources: readonly Resource[];
  readonly settlement: NationSettlement;
}): JSX.Element {
  const [state, setState] = useState<TaxPolicyFormState>(() =>
    initialFormState(policy),
  );
  const upsertMutation = useMutation(
    upsertNationTaxPolicyMutationOptions({ queryClient }),
  );

  function handleSave(): void {
    if (!isFormValid(state)) return;
    upsertMutation.mutate(
      buildPolicyValues(state, {
        nationId: nation.id,
        settlementId: settlement.id,
      }),
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to save settlement override.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Settlement override saved.");
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tax override — {settlement.name}</DialogTitle>
          <DialogDescription>
            Override the nation's default tax rule for this settlement.
          </DialogDescription>
        </DialogHeader>
        <TaxPolicyFields
          disabled={false}
          idPrefix="tax-override"
          resources={resources}
          setState={setState}
          state={state}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={upsertMutation.isPending || !isFormValid(state)}
          >
            {upsertMutation.isPending ? "Saving…" : "Save override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type TributeRow = {
  readonly id: string;
  readonly quantity: string;
  readonly resourceId: string;
};

function newTributeRow(): TributeRow {
  return { id: generateLocalId(), quantity: "", resourceId: "" };
}

function DemandTributeDialog({
  nation,
  onClose,
  queryClient,
  resources,
  settlements,
}: {
  readonly nation: Nation;
  readonly onClose: () => void;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly resources: readonly Resource[];
  readonly settlements: readonly NationSettlement[];
}): JSX.Element {
  const [settlementId, setSettlementId] = useState<string>("");
  const [rows, setRows] = useState<readonly TributeRow[]>(() => [
    newTributeRow(),
  ]);
  const tributeMutation = useMutation(
    demandTributeMutationOptions({ queryClient }),
  );

  const resourceNameById = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource.name])),
    [resources],
  );

  const validItems = rows
    .map((row) => ({
      quantity: Number(row.quantity),
      resourceId: row.resourceId,
    }))
    .filter(
      (item) =>
        item.resourceId !== "" &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0,
    );
  const canSubmit = settlementId !== "" && validItems.length > 0;

  function updateRow(id: string, patch: Partial<TributeRow>): void {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function handleSubmit(): void {
    if (!canSubmit) return;
    tributeMutation.mutate(
      { items: validItems, nationId: nation.id, settlementId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to demand tribute.");
        },
        onSuccess: (results) => {
          const summary = results
            .filter((line) => line.seizedQuantity > 0)
            .map(
              (line) =>
                `${line.seizedQuantity.toLocaleString()} ${
                  resourceNameById.get(line.resourceId) ?? "resource"
                }${line.clamped ? " (clamped)" : ""}`,
            )
            .join(", ");
          notifyMutationSuccess(
            summary === ""
              ? "No resources were available to seize."
              : `Seized ${summary}.`,
          );
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demand tribute</DialogTitle>
          <DialogDescription>
            Immediately seize resources from a settlement's stockpile into this
            nation's treasury. Seizure is clamped to what the settlement holds.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="tribute-settlement">Settlement</Label>
            <Select value={settlementId} onValueChange={setSettlementId}>
              <SelectTrigger id="tribute-settlement" aria-label="Settlement">
                <SelectValue placeholder="Select a settlement" />
              </SelectTrigger>
              <SelectContent>
                {settlements.map((settlement) => (
                  <SelectItem key={settlement.id} value={settlement.id}>
                    {settlement.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Resources</Label>
            {rows.map((row, index) => (
              <div key={row.id} className="flex items-end gap-2">
                <div className="grid flex-1 gap-1">
                  <Select
                    value={row.resourceId}
                    onValueChange={(value) =>
                      updateRow(row.id, { resourceId: value })
                    }
                  >
                    <SelectTrigger aria-label={`Resource ${index + 1}`}>
                      <SelectValue placeholder="Select a resource" />
                    </SelectTrigger>
                    <SelectContent>
                      {resources.map((resource) => (
                        <SelectItem key={resource.id} value={resource.id}>
                          {resource.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid w-28 gap-1">
                  <Input
                    aria-label={`Quantity ${index + 1}`}
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(event) =>
                      updateRow(row.id, { quantity: event.target.value })
                    }
                  />
                </div>
                {rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove resource ${index + 1}`}
                    onClick={() =>
                      setRows((prev) => prev.filter((r) => r.id !== row.id))
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => setRows((prev) => [...prev, newTributeRow()])}
            >
              Add resource
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={tributeMutation.isPending || !canSubmit}
          >
            {tributeMutation.isPending ? "Demanding…" : "Demand tribute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
