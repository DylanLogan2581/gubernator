import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Shield, UserPlus, Globe2, UserCog } from "lucide-react";
import { useState, type ChangeEvent, type JSX, type ReactNode } from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentAppUserQueryOptions } from "@/features/auth";
import { getErrorDescription } from "@/lib/errorUtils";

import { allUsersForSuperadminQueryOptions } from "../queries/superadminQueries";

import { ActivePlayerCharacterAdminDialog } from "./ActivePlayerCharacterAdminDialog";
import { CreateUserDialog } from "./CreateUserDialog";
import { ToggleSuperadminDialog } from "./ToggleSuperadminDialog";
import { WorldAdminGrantDialog } from "./WorldAdminGrantDialog";

import type { SuperadminUser } from "../types/superadminTypes";

type DialogState =
  | { readonly kind: "none" }
  | { readonly kind: "create-user" }
  | { readonly kind: "toggle-superadmin"; readonly user: SuperadminUser }
  | { readonly kind: "world-admin"; readonly user: SuperadminUser }
  | { readonly kind: "active-player-character"; readonly user: SuperadminUser };

export function SuperadminSettingsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const currentUserQuery = useQuery(currentAppUserQueryOptions());
  const usersQuery = useQuery(allUsersForSuperadminQueryOptions());

  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });

  const currentUser = currentUserQuery.data ?? null;

  if (currentUserQuery.isPending || usersQuery.isPending) {
    return (
      <SuperadminFrame>
        <LoadingState label="Loading users…" />
      </SuperadminFrame>
    );
  }

  if (currentUser === null || !currentUser.is_super_admin) {
    return (
      <SuperadminFrame>
        <AccessDeniedState />
      </SuperadminFrame>
    );
  }

  if (usersQuery.isError) {
    return (
      <SuperadminFrame>
        <ErrorState
          title="Could not load users"
          description={getErrorDescription(usersQuery.error)}
        />
      </SuperadminFrame>
    );
  }

  const users = usersQuery.data ?? [];
  const searchTrimmed = search.trim().toLowerCase();
  const filteredUsers =
    searchTrimmed.length === 0
      ? users
      : users.filter(
          (u) =>
            u.email.toLowerCase().includes(searchTrimmed) ||
            u.username.toLowerCase().includes(searchTrimmed),
        );

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>): void {
    setSearch(event.target.value);
  }

  return (
    <SuperadminFrame>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <h1 className="text-xl font-semibold">Superadmin Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage users and system privileges.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setDialog({ kind: "create-user" });
          }}
        >
          <UserPlus aria-hidden="true" />
          Create user
        </Button>
      </div>

      <div className="mt-6">
        <Input
          type="search"
          placeholder="Search by email or username…"
          value={search}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                User
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Superadmin
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Joined
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {searchTrimmed.length > 0
                    ? "No users match your search."
                    : "No users found."}
                </td>
              </tr>
            )}
            {filteredUsers.map((user) => (
              <UserRow
                key={user.id}
                currentUserId={currentUser.id}
                user={user}
                onToggleSuperadmin={() => {
                  setDialog({ kind: "toggle-superadmin", user });
                }}
                onManageWorldAdmin={() => {
                  setDialog({ kind: "world-admin", user });
                }}
                onManageActivePlayerCharacter={() => {
                  setDialog({ kind: "active-player-character", user });
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {dialog.kind === "create-user" && (
        <CreateUserDialog
          queryClient={queryClient}
          onClose={() => {
            setDialog({ kind: "none" });
          }}
          onCreated={() => {
            setDialog({ kind: "none" });
          }}
        />
      )}

      {dialog.kind === "toggle-superadmin" && (
        <ToggleSuperadminDialog
          currentUserId={currentUser.id}
          queryClient={queryClient}
          targetUser={dialog.user}
          onClose={() => {
            setDialog({ kind: "none" });
          }}
        />
      )}

      {dialog.kind === "world-admin" && (
        <WorldAdminGrantDialog
          queryClient={queryClient}
          targetUser={dialog.user}
          onClose={() => {
            setDialog({ kind: "none" });
          }}
        />
      )}

      {dialog.kind === "active-player-character" && (
        <ActivePlayerCharacterAdminDialog
          queryClient={queryClient}
          targetUser={dialog.user}
          onClose={() => {
            setDialog({ kind: "none" });
          }}
        />
      )}
    </SuperadminFrame>
  );
}

type UserRowProps = {
  readonly currentUserId: string;
  readonly onManageActivePlayerCharacter: () => void;
  readonly onManageWorldAdmin: () => void;
  readonly onToggleSuperadmin: () => void;
  readonly user: SuperadminUser;
};

function UserRow({
  currentUserId,
  onManageActivePlayerCharacter,
  onManageWorldAdmin,
  onToggleSuperadmin,
  user,
}: UserRowProps): JSX.Element {
  const isSelf = user.id === currentUserId;

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium">
            {user.username}
            {isSelf && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                (you)
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={user.status === "active" ? "default" : "secondary"}>
          {user.status}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {user.is_super_admin ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <Shield className="size-3" aria-hidden="true" />
            Superadmin
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {user.created_at.slice(0, 10)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onManageWorldAdmin}
            title="Manage world admin access"
          >
            <Globe2 className="size-3.5" aria-hidden="true" />
            Worlds
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onManageActivePlayerCharacter}
            title="Manage active player character (recovery)"
          >
            <UserCog className="size-3.5" aria-hidden="true" />
            Active PC
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleSuperadmin}
            title={
              user.is_super_admin ? "Remove superadmin" : "Grant superadmin"
            }
          >
            <Shield className="size-3.5" aria-hidden="true" />
            {user.is_super_admin ? "Demote" : "Promote"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function SuperadminFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div className="mx-auto max-w-5xl py-6">{children}</div>;
}
