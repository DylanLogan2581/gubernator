import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Pencil, Save } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { availableUsersQueryOptions } from "@/features/auth";
import { nationByIdQueryOptions } from "@/features/nations";
import { RoleAssignmentControls } from "@/features/permissions";
import { settlementByIdQueryOptions } from "@/features/settlements";

import {
  linkUserToCitizenMutationOptions,
  unlinkUserFromCitizenMutationOptions,
} from "../../mutations/playerCharacterRoleMutations";
import { isManagerRole, managerScopeLabel } from "../../utils/citizenRoles";

import { getRoleMutationErrorDescription } from "./ErrorMessages";

import type { Citizen } from "../../types/citizenTypes";

// Role and linked-user writes intentionally route through the dedicated
// SECURITY DEFINER mutations — direct table writes to `user_id` and the
// `role_*` columns are blocked by column-level grants.
export function CitizenPlayerCharacterSection({
  canAdmin,
  canEdit,
  citizen,
  isArchived,
  queryClient,
}: {
  readonly canAdmin: boolean;
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
}): JSX.Element {
  return (
    <section
      aria-labelledby="citizen-player-character-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2
          id="citizen-player-character-heading"
          className="text-base font-medium"
        >
          Role and linked user
        </h2>
        <p className="text-sm text-muted-foreground">
          Player character role and the user that controls them.
        </p>
      </div>
      <CitizenLinkedUserControl
        canEdit={canEdit}
        citizen={citizen}
        queryClient={queryClient}
      />
      <RoleAssignmentControls
        canAdminWorld={canAdmin}
        citizen={citizen}
        isArchived={isArchived}
        variant="citizen"
      />
    </section>
  );
}

function CitizenLinkedUserControl({
  canEdit,
  citizen,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [inputError, setInputError] = useState<string | undefined>(undefined);

  const usersQuery = useQuery(availableUsersQueryOptions());
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
          toast.error(getRoleMutationErrorDescription(error));
        },
        onSuccess: () => {
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
          toast.error(getRoleMutationErrorDescription(error));
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
          toast.error(getRoleMutationErrorDescription(error));
        },
        onSuccess: () => {
          setIsConfirmingUnlink(false);
        },
      },
    );
  }

  const userChoices = usersQuery.data ?? [];

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
    <div className="grid gap-2 rounded-md border border-border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5 text-sm">
          <span className="text-xs text-muted-foreground">Linked user</span>
          {citizen.userId === null ? (
            <span className="italic text-muted-foreground">
              No user linked.
            </span>
          ) : (
            <span className="font-mono text-xs">{citizen.userId}</span>
          )}
        </div>
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
      </div>
      {isEditing ? (
        <form className="grid gap-2" noValidate onSubmit={handleLink}>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">User</span>
            {usersQuery.isError ? (
              <p
                role="alert"
                className="flex h-9 items-center text-sm text-destructive"
              >
                Failed to load users. Please try again.
              </p>
            ) : (
              <select
                aria-invalid={inputError === undefined ? undefined : true}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
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
                    {appUser.username} · {appUser.email}
                  </option>
                ))}
              </select>
            )}
            {inputError === undefined ? null : (
              <p role="alert" className="text-sm text-destructive">
                {inputError}
              </p>
            )}
          </label>
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
