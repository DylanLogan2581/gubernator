import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Pencil, Save } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { availableUsersQueryOptions } from "@/features/auth";
import { nationByIdQueryOptions } from "@/features/nations";
import { settlementByIdQueryOptions } from "@/features/settlements";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  linkUserToCitizenMutationOptions,
  unlinkUserFromCitizenMutationOptions,
} from "../../mutations/playerCharacterRoleMutations";
import { isManagerRole, managerScopeLabel } from "../../utils/citizenRoles";

import { Readout } from "./Shared";

import type { Citizen } from "../../types/citizenTypes";

// Role and linked-user writes intentionally route through the dedicated
// SECURITY DEFINER mutations — direct table writes to `user_id` and the
// `role_*` columns are blocked by column-level grants.
export function CitizenPlayerCharacterSection({
  canAdmin,
  canEdit,
  citizen,
  queryClient,
}: {
  readonly canAdmin: boolean;
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  return (
    <Card
      aria-labelledby="citizen-player-character-heading"
      className="grid gap-3 p-4"
    >
      <div className="space-y-1">
        <h2
          id="citizen-player-character-heading"
          className="text-base font-medium"
        >
          Linked user
        </h2>
        <p className="text-sm text-muted-foreground">
          The user account that controls this player character.
        </p>
      </div>
      {citizen.citizenType === "player_character" ? (
        <CitizenLinkedUserControl
          canAdmin={canAdmin}
          canEdit={canEdit}
          citizen={citizen}
          queryClient={queryClient}
        />
      ) : null}
    </Card>
  );
}

type LinkedUserState =
  | { kind: "unlinked" }
  | { kind: "hidden" }
  | { kind: "pending" }
  | { kind: "error" }
  | { kind: "linked"; name: string }
  | { kind: "unknown" };

function CitizenLinkedUserControl({
  canAdmin,
  canEdit,
  citizen,
  queryClient,
}: {
  readonly canAdmin: boolean;
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [inputError, setInputError] = useState<string | undefined>(undefined);

  const usersQuery = useQuery({
    ...availableUsersQueryOptions(),
    enabled: canAdmin,
  });
  const linkMutation = useMutation(
    linkUserToCitizenMutationOptions({ queryClient }),
  );
  const unlinkMutation = useMutation(
    unlinkUserFromCitizenMutationOptions({ queryClient }),
  );

  const roleScope = managerScopeLabel(citizen.roleType);
  const nationQuery = useQuery({
    ...nationByIdQueryOptions(citizen.roleNationId ?? ""),
    enabled: roleScope === "nation" && citizen.roleNationId !== null,
  });
  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(citizen.roleSettlementId ?? ""),
    enabled: roleScope === "settlement" && citizen.roleSettlementId !== null,
  });

  function closeEditor(): void {
    setIsEditing(false);
    setSelectedUserId("");
    setInputError(undefined);
    linkMutation.reset();
  }

  function handleLink(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setInputError(undefined);
    linkMutation.reset();

    const trimmed = selectedUserId.trim();
    if (trimmed.length === 0) {
      setInputError("Select a user to link.");
      return;
    }

    linkMutation.mutate(
      {
        citizenId: citizen.id,
        userId: trimmed,
        worldId: citizen.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update role.");
        },
        onSuccess: () => {
          notifyMutationSuccess("User linked to citizen.");
          setIsEditing(false);
        },
      },
    );
  }

  function handleUnlink(): void {
    if (isManagerRole(citizen.roleType)) {
      setIsConfirmingUnlink(true);
      return;
    }
    unlinkMutation.reset();
    unlinkMutation.mutate(
      {
        citizenId: citizen.id,
        worldId: citizen.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update role.");
        },
      },
    );
  }

  function handleUnlinkConfirm(): void {
    unlinkMutation.reset();
    unlinkMutation.mutate(
      { citizenId: citizen.id, worldId: citizen.worldId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update role.");
        },
        onSuccess: () => {
          notifyMutationSuccess("User unlinked from citizen.");
          setIsConfirmingUnlink(false);
        },
      },
    );
  }

  const userChoices = usersQuery.data ?? [];
  const linkedUser = userChoices.find((u) => u.id === citizen.userId);
  // Distinct states so a genuinely unlinked citizen ("Not set") is never
  // confused with a hidden (non-admin) or failed-to-load lookup.
  const linkedUserState: LinkedUserState =
    citizen.userId === null
      ? { kind: "unlinked" }
      : !canAdmin
        ? { kind: "hidden" }
        : usersQuery.isPending
          ? { kind: "pending" }
          : usersQuery.isError
            ? { kind: "error" }
            : linkedUser !== undefined
              ? { kind: "linked", name: linkedUser.username }
              : { kind: "unknown" };

  function unlinkRoleDescription(): string {
    if (roleScope === "nation") {
      const name = nationQuery.data?.name ?? null;
      return name !== null
        ? `This will revoke the Nation Manager role for ${name}.`
        : "This will revoke the Nation Manager role.";
    }
    if (roleScope === "settlement") {
      const name = settlementQuery.data?.name ?? null;
      return name !== null
        ? `This will revoke the Settlement Manager role for ${name}.`
        : "This will revoke the Settlement Manager role.";
    }
    return "";
  }

  return (
    <div className="grid gap-2">
      <dl className="grid divide-y divide-border border-y border-border">
        {linkedUserState.kind === "pending" ? (
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="eyebrow">Linked user</dt>
            <dd>
              <Skeleton className="h-4 w-32" />
            </dd>
          </div>
        ) : linkedUserState.kind === "hidden" ? (
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="eyebrow">Linked user</dt>
            <dd className="text-sm italic text-right text-muted-foreground">
              Linked user hidden
            </dd>
          </div>
        ) : linkedUserState.kind === "error" ? (
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="eyebrow">Linked user</dt>
            <dd className="flex items-center gap-2 text-sm text-destructive">
              <span>Couldn't load linked user.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void usersQuery.refetch()}
              >
                Retry
              </Button>
            </dd>
          </div>
        ) : (
          <Readout
            label="Linked user"
            mono={false}
            value={
              linkedUserState.kind === "linked"
                ? linkedUserState.name
                : linkedUserState.kind === "unknown"
                  ? "Unknown user"
                  : null
            }
          />
        )}
      </dl>
      {canEdit && !isEditing ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Pencil aria-hidden="true" />
            {citizen.userId === null ? "Link user" : "Change user"}
          </Button>
          {citizen.userId === null ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUnlink}
              disabled={unlinkMutation.isPending}
            >
              {unlinkMutation.isPending ? "Unlinking…" : "Unlink"}
            </Button>
          )}
        </div>
      ) : null}
      {isEditing ? (
        <form className="grid gap-2" noValidate onSubmit={handleLink}>
          <div className="grid gap-1 text-sm">
            <Label>User</Label>
            {usersQuery.isError ? (
              <p
                role="alert"
                className="flex h-9 items-center text-sm text-destructive"
              >
                Couldn't load users. Refresh and try again.
              </p>
            ) : (
              <NativeSelect
                aria-invalid={inputError === undefined ? undefined : true}
                aria-label="User"
                disabled={linkMutation.isPending || usersQuery.isPending}
                value={selectedUserId}
                onChange={(event) => {
                  setSelectedUserId(event.currentTarget.value);
                  if (inputError !== undefined) {
                    setInputError(undefined);
                  }
                }}
              >
                <option value="">
                  {usersQuery.isPending ? "Loading users…" : "Select a user…"}
                </option>
                {userChoices.map((appUser) => (
                  <option key={appUser.id} value={appUser.id}>
                    {appUser.username}
                  </option>
                ))}
              </NativeSelect>
            )}
            {inputError === undefined ? null : (
              <p role="alert" className="text-sm text-destructive">
                {inputError}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={linkMutation.isPending || usersQuery.isPending}
            >
              <Save aria-hidden="true" />
              {linkMutation.isPending ? "Linking…" : "Link user"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeEditor}
              disabled={linkMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {isConfirmingUnlink ? (
        <UnlinkRoleConfirmDialog
          isPending={unlinkMutation.isPending}
          roleDescription={unlinkRoleDescription()}
          onCancel={() => {
            setIsConfirmingUnlink(false);
            unlinkMutation.reset();
          }}
          onConfirm={handleUnlinkConfirm}
        />
      ) : null}
    </div>
  );
}

function UnlinkRoleConfirmDialog({
  isPending,
  roleDescription,
  onCancel,
  onConfirm,
}: {
  readonly isPending: boolean;
  readonly roleDescription: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div
        aria-labelledby="unlink-role-confirm-title"
        aria-modal="true"
        className="grid w-full max-w-md gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="space-y-1">
          <h3
            id="unlink-role-confirm-title"
            className="text-lg font-semibold tracking-normal"
          >
            Unlink user
          </h3>
          <p className="text-sm text-muted-foreground">
            {roleDescription} Unlinking this user will also clear their role.
            This action cannot be undone without reassigning.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Unlinking…" : "Unlink user"}
          </Button>
        </div>
      </div>
    </div>
  );
}
