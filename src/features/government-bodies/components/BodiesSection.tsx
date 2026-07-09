import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  citizensByIdsQueryOptions,
  citizensInSettlementQueryOptions,
  playerCharactersInNationQueryOptions,
} from "@/features/citizens";
import type { Citizen } from "@/features/citizens";
import {
  formatNationOfficeType,
  nationOfficeTypesQueryOptions,
  settlementOfficeTypesQueryOptions,
} from "@/features/nations";
import type { OfficeType } from "@/features/nations";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import {
  resolveBodyMembers,
  type BodyCompositionRule,
} from "@/shared/government";

import {
  createGovernmentBodyMutationOptions,
  deleteGovernmentBodyMutationOptions,
  updateGovernmentBodyMutationOptions,
} from "../mutations/governmentBodiesMutations";
import {
  nationBodyResolverContextQueryOptions,
  nationGovernmentBodiesQueryOptions,
  settlementBodyResolverContextQueryOptions,
  settlementGovernmentBodiesQueryOptions,
} from "../queries/governmentBodiesQueries";

import type {
  BodyResolverContext,
  GovernmentBody,
} from "../types/governmentBodyTypes";

type BodyScopeContext =
  | {
      readonly scope: "nation";
      readonly nationId: string;
      readonly worldId: string;
    }
  | {
      readonly scope: "settlement";
      readonly nationId: string;
      readonly settlementId: string;
      readonly worldId: string;
    };

export type GovernmentBodiesSectionProps = BodyScopeContext & {
  readonly canManage: boolean;
  readonly isArchived: boolean;
};

// #1116: named voting bodies ("The Senate", "Moot of Elders") for a nation or
// settlement's government tab. Membership is a composition rule list,
// resolved to a concrete citizen roster via resolveBodyMembers (src/shared).
export function GovernmentBodiesSection(
  props: GovernmentBodiesSectionProps,
): JSX.Element {
  const { canManage, isArchived } = props;
  const queryClient = useQueryClient();

  const isNationScope = props.scope === "nation";
  const settlementId = props.scope === "settlement" ? props.settlementId : "";

  // Both branches of every scope-dependent query pair are always called
  // (rules of hooks) but only the one matching `props.scope` is enabled;
  // this keeps each queryOptions() call concretely typed instead of a
  // ternary that would union two incompatible query-key literal types.
  const nationBodiesQuery = useQuery({
    ...nationGovernmentBodiesQueryOptions(props.nationId),
    enabled: isNationScope,
  });
  const settlementBodiesQuery = useQuery({
    ...settlementGovernmentBodiesQueryOptions(settlementId),
    enabled: !isNationScope,
  });
  const bodiesQuery = isNationScope ? nationBodiesQuery : settlementBodiesQuery;

  const nationResolverContextQuery = useQuery({
    ...nationBodyResolverContextQueryOptions(props.nationId),
    enabled: isNationScope,
  });
  const settlementResolverContextQuery = useQuery({
    ...settlementBodyResolverContextQueryOptions(settlementId),
    enabled: !isNationScope,
  });
  const resolverContextQuery = isNationScope
    ? nationResolverContextQuery
    : settlementResolverContextQuery;

  const nationOfficeTypesQuery = useQuery({
    ...nationOfficeTypesQueryOptions(props.worldId, props.nationId),
    enabled: isNationScope,
  });
  const settlementOfficeTypesQuery = useQuery({
    ...settlementOfficeTypesQueryOptions(props.worldId, props.nationId),
    enabled: !isNationScope,
  });
  const officeTypesQuery = isNationScope
    ? nationOfficeTypesQuery
    : settlementOfficeTypesQuery;

  const playerCharactersQuery = useQuery({
    ...playerCharactersInNationQueryOptions(props.nationId),
    enabled: isNationScope,
  });
  const settlementCitizensQuery = useQuery({
    ...citizensInSettlementQueryOptions(settlementId),
    enabled: !isNationScope,
  });
  const candidatesQuery = isNationScope
    ? playerCharactersQuery
    : settlementCitizensQuery;

  const deleteMutation = useMutation(
    deleteGovernmentBodyMutationOptions({ queryClient }),
  );

  const [editing, setEditing] = useState<GovernmentBody | "new" | null>(null);
  const [deleting, setDeleting] = useState<GovernmentBody | null>(null);

  const bodies = bodiesQuery.data ?? [];
  // Alive-status lookup for citizens named by an explicit "citizens" rule --
  // office holders / ruler / settlement managers are already alive by
  // construction (their queries filter on status), only explicit picks can
  // reference someone who has since died.
  const explicitCitizenIds = [
    ...new Set(
      bodies.flatMap((body) =>
        body.composition.flatMap((rule) =>
          rule.kind === "citizens" ? rule.citizenIds : [],
        ),
      ),
    ),
  ];
  const listCitizensQuery = useQuery(
    citizensByIdsQueryOptions(explicitCitizenIds),
  );

  if (
    bodiesQuery.isPending ||
    resolverContextQuery.isPending ||
    officeTypesQuery.isPending ||
    candidatesQuery.isPending ||
    (listCitizensQuery.isPending && explicitCitizenIds.length > 0)
  ) {
    return (
      <BodiesCardFrame canManage={canManage} onAdd={undefined}>
        <LoadingState label="Loading bodies…" />
      </BodiesCardFrame>
    );
  }

  if (
    bodiesQuery.isError ||
    resolverContextQuery.isError ||
    officeTypesQuery.isError ||
    candidatesQuery.isError ||
    (listCitizensQuery.isError && explicitCitizenIds.length > 0)
  ) {
    return (
      <BodiesCardFrame canManage={canManage} onAdd={undefined}>
        <ErrorState
          title="Bodies could not be loaded"
          description={getErrorDescription(
            bodiesQuery.error ??
              resolverContextQuery.error ??
              officeTypesQuery.error ??
              candidatesQuery.error ??
              listCitizensQuery.error,
          )}
        />
      </BodiesCardFrame>
    );
  }

  const resolverContext = resolverContextQuery.data;
  const aliveExplicitCitizenIds = (listCitizensQuery.data ?? [])
    .filter((citizen) => citizen.status === "alive")
    .map((citizen) => citizen.id);
  const aliveCitizenIds = new Set([
    ...(resolverContext.rulerCitizenId !== null
      ? [resolverContext.rulerCitizenId]
      : []),
    ...resolverContext.settlementManagerCitizenIds,
    ...resolverContext.officeHolders.map((holder) => holder.citizenId),
    ...aliveExplicitCitizenIds,
  ]);

  function handleDeleteConfirm(): void {
    if (deleting === null) return;
    deleteMutation.mutate(
      {
        id: deleting.id,
        nationId: deleting.nationId,
        settlementId: deleting.settlementId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to delete body.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${deleting.name} deleted.`);
          setDeleting(null);
        },
      },
    );
  }

  return (
    <>
      <BodiesCardFrame
        canManage={canManage}
        onAdd={isArchived ? undefined : () => setEditing("new")}
      >
        {bodies.length === 0 ? (
          <EmptyState
            title="No voting bodies yet"
            description="Create a body like The Senate or Moot of Elders to define who votes on future amendments."
          />
        ) : (
          <ul className="grid gap-2">
            {bodies.map((body) => {
              const memberIds = resolveBodyMembers(body, {
                ...resolverContext,
                aliveCitizenIds,
              });
              return (
                <li
                  key={body.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div className="grid gap-0.5">
                    <span className="font-medium">{body.name}</span>
                    {body.description !== null ? (
                      <span className="text-xs text-muted-foreground">
                        {body.description}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {memberIds.length}{" "}
                      {memberIds.length === 1 ? "member" : "members"}
                    </span>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isArchived}
                        onClick={() => setEditing(body)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isArchived}
                        onClick={() => setDeleting(body)}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </BodiesCardFrame>

      {canManage && editing !== null ? (
        <BodyEditDialog
          body={editing === "new" ? null : editing}
          candidates={candidatesQuery.data}
          officeTypes={officeTypesQuery.data}
          onClose={() => setEditing(null)}
          queryClient={queryClient}
          resolverContext={resolverContext}
          scopeContext={props}
        />
      ) : null}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete body?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting === null
                ? ""
                : `This will permanently delete ${deleting.name}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Keep body
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const RULE_KIND_LABELS: Readonly<Record<BodyCompositionRule["kind"], string>> =
  {
    office_type: "Holders of an office",
    citizens: "Specific citizens",
    ruler: "The ruler",
    settlement_managers: "Settlement managers",
  };

function defaultRuleForKind(
  kind: BodyCompositionRule["kind"],
  firstOfficeTypeId: string | undefined,
): BodyCompositionRule {
  switch (kind) {
    case "office_type":
      return { kind, officeTypeId: firstOfficeTypeId ?? "" };
    case "citizens":
      return { kind, citizenIds: [] };
    case "ruler":
      return { kind };
    case "settlement_managers":
      return { kind };
  }
}

function BodyEditDialog({
  body,
  candidates,
  officeTypes,
  onClose,
  queryClient,
  resolverContext,
  scopeContext,
}: {
  readonly body: GovernmentBody | null;
  readonly candidates: readonly Citizen[];
  readonly officeTypes: readonly OfficeType[];
  readonly onClose: () => void;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly resolverContext: BodyResolverContext;
  readonly scopeContext: BodyScopeContext;
}): JSX.Element {
  const [name, setName] = useState(body?.name ?? "");
  const [description, setDescription] = useState(body?.description ?? "");
  const [rules, setRules] = useState<
    readonly { readonly key: string; readonly rule: BodyCompositionRule }[]
  >(() =>
    (body?.composition ?? []).map((rule) => ({
      key: globalThis.crypto.randomUUID(),
      rule,
    })),
  );

  const createMutation = useMutation(
    createGovernmentBodyMutationOptions({ queryClient }),
  );
  const updateMutation = useMutation(
    updateGovernmentBodyMutationOptions({ queryClient }),
  );
  const isPending = createMutation.isPending || updateMutation.isPending;

  const explicitCitizenIds = [
    ...new Set(
      rules.flatMap(({ rule }) =>
        rule.kind === "citizens" ? rule.citizenIds : [],
      ),
    ),
  ];
  const explicitCitizensQuery = useQuery(
    citizensByIdsQueryOptions(explicitCitizenIds),
  );

  const nameById = new Map<string, string>();
  for (const citizen of candidates) {
    nameById.set(citizen.id, citizen.name);
  }
  for (const citizen of explicitCitizensQuery.data ?? []) {
    nameById.set(citizen.id, citizen.name);
  }

  const explicitAliveIds = (explicitCitizensQuery.data ?? [])
    .filter((c) => c.status === "alive")
    .map((c) => c.id);
  const aliveCitizenIds = new Set([
    ...(resolverContext.rulerCitizenId !== null
      ? [resolverContext.rulerCitizenId]
      : []),
    ...resolverContext.settlementManagerCitizenIds,
    ...resolverContext.officeHolders.map((h) => h.citizenId),
    ...explicitAliveIds,
  ]);
  const previewMemberIds =
    rules.length === 0
      ? []
      : resolveBodyMembers(
          { composition: rules.map(({ rule }) => rule) },
          { ...resolverContext, aliveCitizenIds },
        );

  function updateRule(key: string, rule: BodyCompositionRule): void {
    setRules(rules.map((r) => (r.key === key ? { key, rule } : r)));
  }

  function removeRule(key: string): void {
    setRules(rules.filter((r) => r.key !== key));
  }

  function addRule(): void {
    setRules([
      ...rules,
      {
        key: globalThis.crypto.randomUUID(),
        rule: defaultRuleForKind("office_type", officeTypes[0]?.id),
      },
    ]);
  }

  function handleSubmit(): void {
    const trimmedName = name.trim();
    if (trimmedName === "" || rules.length === 0) return;

    // Deep-copy to mutable arrays: the zod input schema infers a mutable
    // array shape, but `rules` state is readonly.
    const composition = rules.map(({ rule }) =>
      rule.kind === "citizens"
        ? { citizenIds: [...rule.citizenIds], kind: rule.kind }
        : rule,
    );

    if (body === null) {
      createMutation.mutate(
        {
          composition,
          description,
          name: trimmedName,
          nationId:
            scopeContext.scope === "nation" ? scopeContext.nationId : null,
          settlementId:
            scopeContext.scope === "settlement"
              ? scopeContext.settlementId
              : null,
          worldId: scopeContext.worldId,
        },
        {
          onError: (error) => {
            notifyMutationError(error, "Failed to create body.");
          },
          onSuccess: () => {
            notifyMutationSuccess(`${trimmedName} created.`);
            onClose();
          },
        },
      );
      return;
    }

    updateMutation.mutate(
      {
        composition,
        description,
        id: body.id,
        name: trimmedName,
        nationId: body.nationId,
        settlementId: body.settlementId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update body.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${trimmedName} updated.`);
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{body === null ? "New body" : "Edit body"}</DialogTitle>
          <DialogDescription>
            A citizen is a member of this body if they match any rule below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="body-name">Name</Label>
            <Input
              id="body-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="The Senate"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="body-description">Description (optional)</Label>
            <Textarea
              id="body-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Composition rules</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRule}
              >
                Add rule
              </Button>
            </div>
            {rules.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add at least one rule.
              </p>
            ) : (
              <ul className="grid gap-2">
                {rules.map(({ key, rule }) => (
                  <RuleRow
                    key={key}
                    candidates={candidates}
                    nameById={nameById}
                    officeTypes={officeTypes}
                    onChange={(next) => updateRule(key, next)}
                    onRemove={() => removeRule(key)}
                    rule={rule}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-1 border-t border-border pt-3">
            <h3 className="text-sm font-medium">
              Member preview ({previewMemberIds.length})
            </h3>
            {previewMemberIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">No members yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {previewMemberIds.map((citizenId) => (
                  <Badge key={citizenId} variant="secondary">
                    {nameById.get(citizenId) ?? citizenId}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || name.trim() === "" || rules.length === 0}
          >
            {isPending ? "Saving…" : body === null ? "Create body" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleRow({
  candidates,
  nameById,
  officeTypes,
  onChange,
  onRemove,
  rule,
}: {
  readonly candidates: readonly Citizen[];
  readonly nameById: ReadonlyMap<string, string>;
  readonly officeTypes: readonly OfficeType[];
  readonly onChange: (rule: BodyCompositionRule) => void;
  readonly onRemove: () => void;
  readonly rule: BodyCompositionRule;
}): JSX.Element {
  return (
    <li className="grid gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <Select
          value={rule.kind}
          onValueChange={(value) =>
            onChange(
              defaultRuleForKind(
                value as BodyCompositionRule["kind"],
                officeTypes[0]?.id,
              ),
            )
          }
        >
          <SelectTrigger aria-label="Rule kind" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RULE_KIND_LABELS).map(([kind, label]) => (
              <SelectItem key={kind} value={kind}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      {rule.kind === "office_type" ? (
        <Select
          value={rule.officeTypeId}
          onValueChange={(value) =>
            onChange({ kind: "office_type", officeTypeId: value })
          }
        >
          <SelectTrigger aria-label="Office">
            <SelectValue placeholder="Select an office" />
          </SelectTrigger>
          <SelectContent>
            {officeTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {formatNationOfficeType(type.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {rule.kind === "citizens" ? (
        <div className="grid max-h-40 gap-1 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No eligible citizens.
            </p>
          ) : (
            candidates.map((citizen) => {
              const checked = rule.citizenIds.includes(citizen.id);
              return (
                <label
                  key={citizen.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      onChange({
                        kind: "citizens",
                        citizenIds:
                          next === true
                            ? [...rule.citizenIds, citizen.id]
                            : rule.citizenIds.filter((id) => id !== citizen.id),
                      })
                    }
                  />
                  {nameById.get(citizen.id) ?? citizen.name}
                </label>
              );
            })
          )}
        </div>
      ) : null}

      {rule.kind === "ruler" ? (
        <p className="text-xs text-muted-foreground">
          The current nation or settlement manager.
        </p>
      ) : null}

      {rule.kind === "settlement_managers" ? (
        <p className="text-xs text-muted-foreground">
          Every settlement manager citizen of the nation.
        </p>
      ) : null}
    </li>
  );
}

function BodiesCardFrame({
  canManage,
  children,
  onAdd,
}: {
  readonly canManage: boolean;
  readonly children: JSX.Element;
  readonly onAdd: (() => void) | undefined;
}): JSX.Element {
  return (
    <Card
      aria-labelledby="government-bodies-heading"
      className="grid gap-3 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="government-bodies-heading" className="text-base font-medium">
          Bodies
        </h2>
        {canManage && onAdd !== undefined ? (
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            New body
          </Button>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
