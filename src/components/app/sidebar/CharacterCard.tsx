import { Link } from "@tanstack/react-router";
import { Check, ChevronsUpDown, ShieldCheck } from "lucide-react";

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
import { CitizenAvatar, type Citizen } from "@/features/citizens";
import {
  CharacterRoleLabel,
  useActivePlayerCharacter,
} from "@/features/permissions";

import type { JSX } from "react";

type CharacterCardProps = {
  readonly canAdmin: boolean;
  readonly worldId: string;
};

// Sidebar-native character switcher (issue #1012) — matches the
// WorldSwitcher pattern above it (SidebarMenu + SidebarMenuButton size="lg"
// + DropdownMenu) instead of the old header-bar pill it replaced. Reuses
// useActivePlayerCharacter for all switch/clear logic; only the presentation
// is sidebar-specific. No "Admin paused" badge — the state is implied by
// which row renders.
// - No active PC and not admin -> renders nothing.
// - At most one choice (nothing to switch to) -> static row, no dropdown:
//   a citizen-detail link when there's an active PC, or a plain "World
//   Admin" row when admin has no PCs at all.
// - Otherwise -> trigger + dropdown with an explicit "Admin" entry
//   (clearing the active PC returns to admin) alongside selectable
//   characters, mirroring the former header switcher's semantics
//   (see issue #978 on why "Admin" is a menu entry, not a Clear button).
export function CharacterCard({
  canAdmin,
  worldId,
}: CharacterCardProps): JSX.Element | null {
  const { activeCharacter, clear, isPending, selectableCharacters, switchTo } =
    useActivePlayerCharacter();
  const { isMobile } = useSidebar();

  if (activeCharacter === null && !canAdmin) {
    return null;
  }

  const hasMenu = selectableCharacters.length + (canAdmin ? 1 : 0) > 1;

  if (!hasMenu) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          {activeCharacter === null ? (
            <SidebarMenuButton asChild size="lg" tooltip="World Admin">
              <div className="cursor-default hover:bg-transparent active:bg-transparent">
                <WorldAdminIcon />
                <span className="truncate font-medium">World Admin</span>
              </div>
            </SidebarMenuButton>
          ) : (
            <SidebarMenuButton asChild size="lg" tooltip={activeCharacter.name}>
              <Link
                to="/worlds/$worldId/citizens/$citizenId"
                params={{ citizenId: activeCharacter.id, worldId }}
              >
                <CitizenAvatar
                  id={activeCharacter.id}
                  name={activeCharacter.name}
                  profilePhotoUrl={activeCharacter.profilePhotoUrl}
                  size="sm"
                />
                <CharacterLabel citizen={activeCharacter} />
              </Link>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={activeCharacter?.name ?? "World Admin"}
            >
              {activeCharacter === null ? (
                <WorldAdminIcon />
              ) : (
                <CitizenAvatar
                  id={activeCharacter.id}
                  name={activeCharacter.name}
                  profilePhotoUrl={activeCharacter.profilePhotoUrl}
                  size="sm"
                />
              )}
              {activeCharacter === null ? (
                <span className="truncate font-medium">World Admin</span>
              ) : (
                <CharacterLabel citizen={activeCharacter} />
              )}
              <ChevronsUpDown
                className="ml-auto size-4 text-sidebar-foreground/50"
                aria-hidden="true"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Switch character
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {canAdmin ? (
              <DropdownMenuItem
                disabled={isPending || activeCharacter === null}
                onSelect={() => {
                  if (activeCharacter === null) {
                    return;
                  }
                  clear();
                }}
                className="gap-2"
              >
                <ShieldCheck
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm font-medium">Admin</span>
                {activeCharacter === null ? (
                  <Check
                    className="size-3.5 text-muted-foreground"
                    aria-label="Current"
                  />
                ) : null}
              </DropdownMenuItem>
            ) : null}
            {canAdmin && selectableCharacters.length > 0 ? (
              <DropdownMenuSeparator />
            ) : null}
            {selectableCharacters.map((candidate) => {
              const isActive = candidate.id === activeCharacter?.id;
              return (
                <DropdownMenuItem
                  key={candidate.id}
                  disabled={isPending || isActive}
                  onSelect={() => {
                    if (isActive) {
                      return;
                    }
                    switchTo(candidate.id);
                  }}
                  className="gap-2"
                >
                  <CitizenAvatar
                    id={candidate.id}
                    name={candidate.name}
                    profilePhotoUrl={candidate.profilePhotoUrl}
                    size="sm"
                  />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {candidate.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      <CharacterRoleLabel citizen={candidate} />
                    </span>
                  </span>
                  {isActive ? (
                    <Check
                      className="size-3.5 text-muted-foreground"
                      aria-label="Current"
                    />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function WorldAdminIcon(): JSX.Element {
  return (
    <div className="flex size-6 shrink-0 items-center justify-center">
      <ShieldCheck className="size-4" aria-hidden="true" />
    </div>
  );
}

function CharacterLabel({
  citizen,
}: {
  readonly citizen: Citizen;
}): JSX.Element {
  return (
    <span className="grid flex-1 text-left leading-tight">
      <span className="truncate font-medium">{citizen.name}</span>
      <span className="truncate text-xs text-sidebar-foreground/70">
        <CharacterRoleLabel citizen={citizen} />
      </span>
    </span>
  );
}
