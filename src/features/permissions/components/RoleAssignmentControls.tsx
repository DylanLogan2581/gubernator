import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  assignCitizenRoleMutationOptions,
  isPlayerCharacterRoleMutationError,
  isPlayerRole,
  managerScopeLabel,
  playerCharactersInNationQueryOptions,
  revokeCitizenRoleMutationOptions,
  type Citizen,
} from "@/features/citizens";
import type { Nation } from "@/features/nations";
import { settlementByIdQueryOptions } from "@/features/settlements";
import { getErrorDescription } from "@/lib/errorUtils";

import { permissionQueryKeys } from "../queries/permissionQueryKeys";

type CitizenVariantProps = {
  readonly canAdminWorld: boolean;
  readonly citizen: Citizen;
  readonly isArchived: boolean;
  readonly variant: "citizen";
};

type NationVariantProps = {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly isNationManager: boolean;
  readonly nation: Nation;
  readonly variant: "nation";
};

export type RoleAssignmentControlsProps =
  | CitizenVariantProps
  | NationVariantProps;

// Shared role-assignment surface for the two places it appears in the app:
// the citizen detail screen (World Admin path) and the nation detail screen
// (Nation Manager path, restricted to Settlement Manager only).
// Direct writes to role columns are blocked by column-level grants, so all
// changes route through the assign_citizen_role / revoke_citizen_role RPCs.
export function RoleAssignmentControls(
  props: RoleAssignmentControlsProps,
): JSX.Element | null {
  if (props.variant === "citizen") {
    return <CitizenRoleAssignmentControls {...props} />;
  }
  return <NationRoleAssignmentControls {...props} />;
}

type RoleSelection = "none" | "nation_manager" | "settlement_manager";

function CitizenRoleAssignmentControls({
  canAdminWorld,
  citizen,
  isArchived,
}: CitizenVariantProps): JSX.Element | null {
  if (!canAdminWorld) {
    return null;
  }
  if (citizen.citizenType !== "player_character") {
    return null;
  }

  return (
    <CitizenRoleAssignmentForm citizen={citizen} isArchived={isArchived} />
  );
}

function CitizenRoleAssignmentForm({
  citizen,
  isArchived,
}: {
  readonly citizen: Citizen;
  readonly isArchived: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const settlementId = citizen.settlementId;
  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(settlementId ?? ""),
    enabled: settlementId !== null,
  });
  const settlement = settlementQuery.data ?? null;
  const settlementNationId = settlement?.nationId ?? null;
  const settlementName = settlement?.name ?? null;
  const nationName = settlement?.nation.name ?? null;

  const [isEditing, setIsEditing] = useState(false);
  const [roleType, setRoleType] = useState<RoleSelection>(citizen.roleType);
  const [scopeError, setScopeError] = useState<string | undefined>(undefined);

  const assignMutation = useMutation(
    assignCitizenRoleMutationOptions({ queryClient }),
  );
  const revokeMutation = useMutation(
    revokeCitizenRoleMutationOptions({ queryClient }),
  );

  function closeEditor(): void {
    setIsEditing(false);
    setRoleType(citizen.roleType);
    setScopeError(undefined);
    assignMutation.reset();
    revokeMutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setScopeError(undefined);
    assignMutation.reset();
    revokeMutation.reset();

    if (isPlayerRole(roleType)) {
      revokeMutation.mutate(
        { citizenId: citizen.id, worldId: citizen.worldId },
        {
          onSuccess: () => {
            invalidatePermissionsContext(queryClient);
            setIsEditing(false);
          },
        },
      );
      return;
    }

    if (settlementId === null) {
      setScopeError(
        "Citizen must belong to a settlement before a role can be assigned.",
      );
      return;
    }

    if (managerScopeLabel(roleType) === "nation") {
      if (settlementNationId === null) {
        setScopeError("Citizen's settlement is not attached to a nation.");
        return;
      }
      assignMutation.mutate(
        {
          citizenId: citizen.id,
          roleNationId: settlementNationId,
          roleType: "nation_manager",
          worldId: citizen.worldId,
        },
        {
          onSuccess: () => {
            invalidatePermissionsContext(queryClient);
            setIsEditing(false);
          },
        },
      );
      return;
    }

    assignMutation.mutate(
      {
        citizenId: citizen.id,
        roleSettlementId: settlementId,
        roleType: "settlement_manager",
        worldId: citizen.worldId,
      },
      {
        onSuccess: () => {
          invalidatePermissionsContext(queryClient);
          setIsEditing(false);
        },
      },
    );
  }

  const canEdit = !isArchived;
  const firstError = assignMutation.error ?? revokeMutation.error ?? null;
  const isPending = assignMutation.isPending || revokeMutation.isPending;

  return (
    <div className="grid gap-2 rounded-md border border-border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5 text-sm">
          <span className="text-xs text-muted-foreground">Role</span>
          <span>{citizenRoleLabel(citizen, nationName, settlementName)}</span>
        </div>
        {canEdit && !isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Pencil aria-hidden="true" />
            Change role
          </Button>
        ) : null}
      </div>
      {isEditing ? (
        <form
          aria-label="Change citizen role"
          className="grid gap-2"
          noValidate
          onSubmit={handleSubmit}
        >
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Role type</span>
            <select
              aria-label="Role type"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              disabled={isPending}
              value={roleType}
              onChange={(event) => {
                setRoleType(event.currentTarget.value as RoleSelection);
                setScopeError(undefined);
              }}
            >
              <option value="none">None</option>
              <option value="nation_manager">Nation manager</option>
              <option value="settlement_manager">Settlement manager</option>
            </select>
          </label>
          {managerScopeLabel(roleType) === "nation" ? (
            <ScopeDropdown
              label="Nation"
              optionLabel={nationName ?? settlementNationId ?? ""}
              optionValue={settlementNationId ?? ""}
              isLoading={settlementQuery.isPending && settlementId !== null}
            />
          ) : null}
          {managerScopeLabel(roleType) === "settlement" ? (
            <ScopeDropdown
              label="Settlement"
              optionLabel={settlementName ?? settlementId ?? ""}
              optionValue={settlementId ?? ""}
              isLoading={settlementQuery.isPending && settlementId !== null}
            />
          ) : null}
          {scopeError === undefined ? null : (
            <p role="alert" className="text-sm text-destructive">
              {scopeError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              <Save aria-hidden="true" />
              {isPending ? "Saving…" : "Save role"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeEditor}
              disabled={isPending}
            >
              <X aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {firstError !== null ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getRoleMutationErrorDescription(firstError)}
        </p>
      ) : null}
    </div>
  );
}

// Read-only preview of the resolved scope. The scope is always derived from
// the citizen's current settlement, so the select is intentionally disabled —
// it confirms where the role will be applied, not allows the user to pick a
// different target. If multi-target assignment is ever supported (e.g. assigning
// a nation_manager to any nation regardless of settlement), this will become
// an interactive picker.
function ScopeDropdown({
  isLoading,
  label,
  optionLabel,
  optionValue,
}: {
  readonly isLoading: boolean;
  readonly label: string;
  readonly optionLabel: string;
  readonly optionValue: string;
}): JSX.Element {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        aria-label={label}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        disabled
        value={optionValue}
      >
        {isLoading ? (
          <option value="">Loading…</option>
        ) : (
          <option value={optionValue}>
            {optionLabel === "" ? "Not available" : optionLabel}
          </option>
        )}
      </select>
    </label>
  );
}

function NationRoleAssignmentControls({
  canAdminWorld,
  isArchived,
  isNationManager,
  nation,
}: NationVariantProps): JSX.Element | null {
  if (!canAdminWorld && !isNationManager) {
    return null;
  }

  return <NationRoleAssignmentList isArchived={isArchived} nation={nation} />;
}

function NationRoleAssignmentList({
  isArchived,
  nation,
}: {
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const playerCharactersQuery = useQuery(
    playerCharactersInNationQueryOptions(nation.id),
  );

  if (playerCharactersQuery.isPending) {
    return <LoadingState label="Loading player characters…" />;
  }

  if (playerCharactersQuery.isError) {
    return (
      <ErrorState
        title="Player characters could not be loaded"
        description={getErrorDescription(playerCharactersQuery.error)}
      />
    );
  }

  const candidates = playerCharactersQuery.data.filter(
    (citizen) => managerScopeLabel(citizen.roleType) !== "nation",
  );

  if (candidates.length === 0) {
    return (
      <EmptyState
        title="No assignable player characters"
        description="This nation has no player characters available to assign as Settlement Manager."
      />
    );
  }

  return (
    <ul className="grid gap-2" aria-label="Player characters">
      {candidates.map((citizen) => (
        <NationRoleAssignmentRow
          key={citizen.id}
          citizen={citizen}
          isArchived={isArchived}
        />
      ))}
    </ul>
  );
}

function NationRoleAssignmentRow({
  citizen,
  isArchived,
}: {
  readonly citizen: Citizen;
  readonly isArchived: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const assignMutation = useMutation(
    assignCitizenRoleMutationOptions({ queryClient }),
  );
  const revokeMutation = useMutation(
    revokeCitizenRoleMutationOptions({ queryClient }),
  );

  const settlementId = citizen.settlementId;
  const isPending = assignMutation.isPending || revokeMutation.isPending;
  const isSettlementManager =
    managerScopeLabel(citizen.roleType) === "settlement";

  function handleAssign(): void {
    if (settlementId === null) {
      return;
    }
    assignMutation.reset();
    revokeMutation.reset();
    assignMutation.mutate(
      {
        citizenId: citizen.id,
        roleSettlementId: settlementId,
        roleType: "settlement_manager",
        worldId: citizen.worldId,
      },
      {
        onSuccess: () => invalidatePermissionsContext(queryClient),
      },
    );
  }

  function handleRevoke(): void {
    revokeMutation.reset();
    assignMutation.reset();
    revokeMutation.mutate(
      { citizenId: citizen.id, worldId: citizen.worldId },
      {
        onSuccess: () => invalidatePermissionsContext(queryClient),
      },
    );
  }

  const firstError = assignMutation.error ?? revokeMutation.error ?? null;

  return (
    <li className="grid gap-2 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5 text-sm">
          <span className="font-medium">{citizen.name}</span>
          <span className="text-xs text-muted-foreground">
            {isSettlementManager ? "Settlement manager" : "No role"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSettlementManager ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || isArchived}
              onClick={handleRevoke}
            >
              {revokeMutation.isPending ? "Revoking…" : "Revoke role"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || isArchived || settlementId === null}
              onClick={handleAssign}
            >
              {assignMutation.isPending
                ? "Assigning…"
                : "Assign Settlement Manager"}
            </Button>
          )}
        </div>
      </div>
      {firstError !== null ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getRoleMutationErrorDescription(firstError)}
        </p>
      ) : null}
    </li>
  );
}

function invalidatePermissionsContext(queryClient: QueryClient): void {
  // The active-player-character context derives the active Citizen from
  // permissions-namespaced queries. Citizens invalidation alone won't refresh
  // it, so we also invalidate the permissions namespace.
  void queryClient.invalidateQueries({ queryKey: permissionQueryKeys.all });
}

function citizenRoleLabel(
  citizen: Citizen,
  nationName: string | null,
  settlementName: string | null,
): string {
  switch (citizen.roleType) {
    case "none":
      return "None";
    case "nation_manager":
      return `Nation manager${nationName === null ? "" : ` — ${nationName}`}`;
    case "settlement_manager":
      return `Settlement manager${
        settlementName === null ? "" : ` — ${settlementName}`
      }`;
  }
}

function getRoleMutationErrorDescription(error: unknown): string {
  if (isPlayerCharacterRoleMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}
