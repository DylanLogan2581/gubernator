import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";
import { useId, type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CitizenAvatar, type Citizen } from "@/features/citizens";
import { settlementByIdQueryOptions } from "@/features/settlements";
import { cn } from "@/lib/utils";

import { useActivePlayerCharacter } from "../context/activePlayerCharacterContext";

export type ActiveCharacterSwitcherProps = {
  readonly canAdmin: boolean;
  readonly worldId: string;
};

// Indicator + switcher for the user's active player character.
// - Shows the active PC's name, role, and avatar; clicking opens a switcher.
// - If there is nothing to switch to (a single PC and no admin access, or an
//   admin with no PCs at all), the indicator is static (no menu).
// - If the user has no active PC but is a world admin, renders a "World Admin"
//   indicator so admins can see they are acting without a character.
// - If an admin account has an active PC, admin capability is suppressed
//   (see useEffectiveCanAdmin); shows an "Admin paused" badge, and the switcher
//   menu includes an explicit "Admin" entry alongside characters. Picking it
//   clears the active character AND marks the choice explicit so auto-select
//   doesn't immediately re-select the only PC (the former one-click Clear
//   button raced auto-select and instantly reverted — see issue #978).
// - Otherwise renders nothing.
export function ActiveCharacterSwitcher({
  canAdmin,
  worldId,
}: ActiveCharacterSwitcherProps): JSX.Element | null {
  const { activeCharacter, clear, isPending, selectableCharacters, switchTo } =
    useActivePlayerCharacter();
  const labelId = useId();

  if (activeCharacter === null && !canAdmin) {
    return null;
  }

  // "Choices" = characters to switch to, plus the Admin option itself (which
  // only exists for admins). If there's at most one choice, there's nothing
  // to switch between and the menu would be pointless.
  const hasMenu = selectableCharacters.length + (canAdmin ? 1 : 0) > 1;

  if (!hasMenu) {
    if (activeCharacter === null) {
      return <WorldAdminBadge />;
    }
    return (
      <Link
        to="/worlds/$worldId/citizens/$citizenId"
        params={{ citizenId: activeCharacter.id, worldId }}
        aria-label="Active player character"
        className="inline-flex items-center gap-2"
      >
        <CharacterAvatarWithRole citizen={activeCharacter} />
      </Link>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      {canAdmin && activeCharacter !== null ? <AdminPausedBadge /> : null}

      <div className="inline-flex">
        {activeCharacter === null ? (
          <span
            id={labelId}
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "h-auto gap-2 rounded-r-none border-r-0 py-1.5 pl-1.5 pr-2",
            )}
          >
            <ShieldCheck
              className="size-3.5 text-muted-foreground"
              aria-hidden
            />
            World Admin
          </span>
        ) : (
          <Button
            asChild
            variant="outline"
            size="sm"
            aria-labelledby={labelId}
            className="h-auto gap-2 rounded-r-none border-r-0 py-1.5 pl-1.5 pr-2"
          >
            <Link
              to="/worlds/$worldId/citizens/$citizenId"
              params={{ citizenId: activeCharacter.id, worldId }}
            >
              <CharacterAvatarWithRole
                citizen={activeCharacter}
                labelId={labelId}
              />
            </Link>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Switch character"
              className="h-auto rounded-l-none py-1.5 px-2"
            >
              <ChevronDown
                className="size-3.5 text-muted-foreground"
                aria-hidden
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel>Switch character</DropdownMenuLabel>
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
                  aria-hidden
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
                  <CharacterAvatar citizen={candidate} size="sm" />
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
      </div>
    </div>
  );
}

function WorldAdminBadge(): JSX.Element {
  return (
    <Badge
      variant="secondary"
      aria-label="Acting as World Admin"
      className="gap-1"
    >
      <ShieldCheck className="size-3" aria-hidden />
      World Admin
    </Badge>
  );
}

function AdminPausedBadge(): JSX.Element {
  return (
    <Badge variant="warning" aria-label="Admin access paused" className="gap-1">
      <ShieldAlert className="size-3" aria-hidden />
      Admin paused
    </Badge>
  );
}

function CharacterAvatarWithRole({
  citizen,
  labelId,
}: {
  readonly citizen: Citizen;
  readonly labelId?: string;
}): JSX.Element {
  return (
    <>
      <CharacterAvatar citizen={citizen} size="sm" />
      <span className="grid min-w-0 gap-0 text-left" id={labelId}>
        <span className="truncate text-sm font-medium leading-tight">
          {citizen.name}
        </span>
        <span className="truncate text-xs leading-tight text-muted-foreground">
          <CharacterRoleLabel citizen={citizen} />
        </span>
      </span>
    </>
  );
}

function CharacterAvatar({
  citizen,
  size,
}: {
  readonly citizen: Citizen;
  readonly size: "sm" | "default";
}): JSX.Element {
  return (
    <CitizenAvatar
      id={citizen.id}
      name={citizen.name}
      profilePhotoUrl={citizen.profilePhotoUrl}
      size={size}
    />
  );
}

function CharacterRoleLabel({
  citizen,
}: {
  readonly citizen: Citizen;
}): JSX.Element {
  const settlementId =
    citizen.roleType === "settlement_manager" ? citizen.roleSettlementId : null;
  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(settlementId ?? ""),
    enabled: settlementId !== null,
  });

  switch (citizen.roleType) {
    case "none":
      return <>None</>;
    case "nation_manager":
      return <>Nation manager</>;
    case "settlement_manager": {
      const settlementName = settlementQuery.data?.name ?? null;
      return (
        <>
          Settlement manager
          {settlementName === null ? "" : ` — ${settlementName}`}
        </>
      );
    }
  }
}
