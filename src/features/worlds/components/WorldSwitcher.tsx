import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ChevronsUpDown, Globe2, Plus, Upload } from "lucide-react";
import { useMemo, type JSX } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  createAccessContext,
  currentAccessContextQueryOptions,
} from "@/features/permissions";

import { accessibleWorldsQueryOptions } from "../queries/worldQueries";

export type WorldSwitcherProps = {
  readonly turnLabel: string | null;
  readonly worldId: string | null;
  readonly worldName: string | null;
};

// Sidebar-07 team-switcher pattern (docs/ui-redesign.md §3.2): the trigger
// shows current world identity (or a "Select a world" placeholder outside a
// world); the dropdown lists accessible worlds, an "All worlds" link, and
// (superadmins only, matching WorldListPage's gating) Create/Import entries
// that hand off to the worlds list page rather than duplicating its dialogs.
export function WorldSwitcher({
  turnLabel,
  worldId,
  worldName,
}: WorldSwitcherProps): JSX.Element {
  const queryClient = useQueryClient();
  const { isMobile } = useSidebar();

  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );
  const accessContext = accessContextQuery.data;

  // Placeholder used only until the real access context resolves, so
  // accessibleWorldsQueryOptions always has a context to build a query key
  // from — the query itself stays disabled until real data is in (mirrors
  // UseAppShellWorldContext's PENDING_ACCESS_CONTEXT). Built lazily here
  // (rather than as a module-level constant) since this feature's barrel
  // and the permissions feature's barrel import each other — a top-level
  // call at import time can race that cycle's initialization order.
  const pendingAccessContext = useMemo(
    () =>
      createAccessContext({
        isSuperAdmin: false,
        userId: null,
        worldAdminWorldIds: [],
      }),
    [],
  );

  const worldsQuery = useQuery({
    ...accessibleWorldsQueryOptions(accessContext ?? pendingAccessContext),
    enabled: accessContext !== undefined,
  });
  const worlds = worldsQuery.data ?? [];
  const isSuperAdmin = accessContext?.isSuperAdmin ?? false;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {worldId === null ? (
              <SidebarMenuButton size="lg" tooltip="Select a world">
                <img
                  src="/logo.png"
                  alt=""
                  className="size-6 rounded-md object-contain"
                />
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">Select a world</span>
                </span>
                <ChevronsUpDown
                  className="ml-auto size-4 text-sidebar-foreground/50"
                  aria-hidden="true"
                />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton size="lg" tooltip={worldName ?? "World"}>
                <Globe2 className="size-4 shrink-0" aria-hidden="true" />
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">
                    {worldName ?? "Loading…"}
                  </span>
                  {turnLabel !== null ? (
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {turnLabel}
                    </span>
                  ) : null}
                </span>
                <ChevronsUpDown
                  className="ml-auto size-4 text-sidebar-foreground/50"
                  aria-hidden="true"
                />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Worlds
            </DropdownMenuLabel>
            {worldsQuery.isPending ? (
              <DropdownMenuItem disabled>Loading worlds…</DropdownMenuItem>
            ) : worldsQuery.isError ? (
              <DropdownMenuItem disabled>
                Worlds could not be loaded
              </DropdownMenuItem>
            ) : worlds.length === 0 ? (
              <DropdownMenuItem disabled>No accessible worlds</DropdownMenuItem>
            ) : (
              worlds.map((world) => (
                <DropdownMenuItem key={world.id} asChild className="gap-2">
                  <Link to="/worlds/$worldId" params={{ worldId: world.id }}>
                    <Globe2
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {world.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        Turn {world.currentTurnNumber} ·{" "}
                        {world.inWorldDateLabel}
                      </span>
                    </span>
                    {world.id === worldId ? (
                      <Check
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label="Current"
                      />
                    ) : null}
                  </Link>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <Link to="/worlds">
                <Globe2
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                All worlds
              </Link>
            </DropdownMenuItem>
            {isSuperAdmin ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="gap-2">
                  <Link to="/worlds">
                    <Plus
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Create world
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-2">
                  <Link to="/worlds">
                    <Upload
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Import
                  </Link>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
