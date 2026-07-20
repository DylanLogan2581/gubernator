import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Shield,
  ShieldCheck,
  UserPlus,
  Globe2,
  UserCog,
} from "lucide-react";
import { useState, type ChangeEvent, type JSX } from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currentAppUserQueryOptions } from "@/features/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { getErrorDescription } from "@/lib/errorUtils";
import { formatDate, formatRelativeTime } from "@/lib/formatDate";

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

export function SuperadminUsersPanel(): JSX.Element {
  const queryClient = useQueryClient();
  const currentUserQuery = useQuery(currentAppUserQueryOptions());
  const usersQuery = useQuery(allUsersForSuperadminQueryOptions());
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });

  const currentUser = currentUserQuery.data ?? null;

  if (currentUserQuery.isPending || usersQuery.isPending) {
    return <LoadingState label="Loading users…" />;
  }

  if (currentUser === null || !currentUser.is_super_admin) {
    return <AccessDeniedState />;
  }

  if (usersQuery.isError) {
    return (
      <ErrorState
        title="Could not load users"
        description={getErrorDescription(usersQuery.error)}
      />
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
    <>
      <PageHeader
        icon={ShieldCheck}
        title="Users"
        description="Manage users and system privileges."
      />

      <div className="mt-4 flex items-center justify-between gap-2">
        <Input
          type="search"
          placeholder="Search by email or username…"
          value={search}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
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

      {filteredUsers.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {searchTrimmed.length > 0
            ? "No users match your search."
            : "No users found."}
        </div>
      ) : isMobile ? (
        <div className="mt-4 space-y-2">
          {filteredUsers.map((user) => (
            <UserCard
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
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-3 text-left">User</TableHead>
                <TableHead className="px-4 py-3 text-left">Status</TableHead>
                <TableHead className="px-4 py-3 text-left">
                  Superadmin
                </TableHead>
                <TableHead className="px-4 py-3 text-left">Joined</TableHead>
                <TableHead className="px-4 py-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
            </TableBody>
          </Table>
        </div>
      )}

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
    </>
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
    <TableRow className="hover:bg-muted/30">
      <TableCell className="px-4 py-3">
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
      </TableCell>
      <TableCell className="px-4 py-3">
        <Badge variant={user.status === "active" ? "outline" : "destructive"}>
          {user.status}
        </Badge>
      </TableCell>
      <TableCell className="px-4 py-3">
        {user.is_super_admin ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <Shield className="size-3" aria-hidden="true" />
            Superadmin
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-4 py-3 text-xs text-muted-foreground">
        <span title={user.created_at}>{formatDate(user.created_at)}</span>
        <span className="block text-muted-foreground">
          {formatRelativeTime(user.created_at)}
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 text-right">
        <UserActionsMenu
          user={user}
          onManageActivePlayerCharacter={onManageActivePlayerCharacter}
          onManageWorldAdmin={onManageWorldAdmin}
          onToggleSuperadmin={onToggleSuperadmin}
        />
      </TableCell>
    </TableRow>
  );
}

type UserActionsMenuProps = {
  readonly onManageActivePlayerCharacter: () => void;
  readonly onManageWorldAdmin: () => void;
  readonly onToggleSuperadmin: () => void;
  readonly user: SuperadminUser;
};

function UserActionsMenu({
  onManageActivePlayerCharacter,
  onManageWorldAdmin,
  onToggleSuperadmin,
  user,
}: UserActionsMenuProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${user.username}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onManageWorldAdmin}>
          <Globe2 aria-hidden="true" />
          Manage world admin
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onManageActivePlayerCharacter}>
          <UserCog aria-hidden="true" />
          Manage active PC
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleSuperadmin}>
          <Shield aria-hidden="true" />
          {user.is_super_admin ? "Remove superadmin" : "Grant superadmin"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserCard({
  currentUserId,
  onManageActivePlayerCharacter,
  onManageWorldAdmin,
  onToggleSuperadmin,
  user,
}: UserRowProps): JSX.Element {
  const isSelf = user.id === currentUserId;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {user.username}
          {isSelf && (
            <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={user.status === "active" ? "outline" : "destructive"}>
            {user.status}
          </Badge>
          {user.is_super_admin && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Shield className="size-3" aria-hidden="true" />
              Superadmin
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Joined {formatDate(user.created_at)}
        </p>
      </div>
      <UserActionsMenu
        user={user}
        onManageActivePlayerCharacter={onManageActivePlayerCharacter}
        onManageWorldAdmin={onManageWorldAdmin}
        onToggleSuperadmin={onToggleSuperadmin}
      />
    </div>
  );
}
