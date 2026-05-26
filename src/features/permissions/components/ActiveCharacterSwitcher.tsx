import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, ShieldCheck, UserCircle2 } from "lucide-react";
import { useId, type JSX } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Citizen } from "@/features/citizens";
import { settlementByIdQueryOptions } from "@/features/settlements";

import { useActivePlayerCharacter } from "../context/activePlayerCharacterContext";

export type ActiveCharacterSwitcherProps = {
  readonly canAdmin: boolean;
  readonly worldId: string;
};

// Indicator + switcher for the user's active player character.
// - Shows the active PC's name, role, and avatar; clicking opens a switcher.
// - If the user has only one selectable PC, the indicator is static (no menu).
// - If the user has no active PC but is a world admin, renders a "World Admin"
//   badge so admins can see they are acting without a character.
// - Otherwise renders nothing.
export function ActiveCharacterSwitcher({
  canAdmin,
  worldId,
}: ActiveCharacterSwitcherProps): JSX.Element | null {
  const { activeCharacter, isPending, selectableCharacters, switchTo } =
    useActivePlayerCharacter();
  const labelId = useId();

  if (activeCharacter === null) {
    if (canAdmin) {
      return <WorldAdminBadge />;
    }
    return null;
  }

  const hasSwitcher = selectableCharacters.length > 1;

  if (!hasSwitcher) {
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
    <div className="inline-flex">
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
          {selectableCharacters.map((candidate) => {
            const isActive = candidate.id === activeCharacter.id;
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
  const initial = citizen.name.charAt(0).toUpperCase();
  return (
    <Avatar size={size}>
      {citizen.profilePhotoUrl !== null && citizen.profilePhotoUrl !== "" ? (
        <AvatarImage src={citizen.profilePhotoUrl} alt="" />
      ) : null}
      <AvatarFallback>
        {initial === "" ? (
          <UserCircle2 className="size-4" aria-hidden />
        ) : (
          initial
        )}
      </AvatarFallback>
    </Avatar>
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
      return <>Citizen</>;
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
