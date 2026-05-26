import { useQuery } from "@tanstack/react-query";
import { UserCircle2 } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import type { Citizen } from "@/features/citizens";
import { settlementByIdQueryOptions } from "@/features/settlements";

import { useActivePlayerCharacter } from "../context/activePlayerCharacterContext";

import type { JSX } from "react";

export type PlayerCharacterChooserProps = {
  readonly description?: string;
  readonly heading?: string;
  readonly onSelected?: (citizenId: string) => void;
};

// Chooser UI used both during world entry and from the runtime switcher.
// Reads selectable PCs from the active-PC context and persists the selection
// via the same context's switchTo mutation.
export function PlayerCharacterChooser({
  description,
  heading,
  onSelected,
}: PlayerCharacterChooserProps): JSX.Element {
  const { isPending, selectableCharacters, switchTo } =
    useActivePlayerCharacter();

  if (selectableCharacters.length === 0) {
    return (
      <EmptyState
        title="No selectable characters"
        description="You have no living player characters in this world."
      />
    );
  }

  function handleSelect(citizenId: string): void {
    switchTo(citizenId);
    if (onSelected !== undefined) {
      onSelected(citizenId);
    }
  }

  return (
    <section
      aria-labelledby="player-character-chooser-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2
          id="player-character-chooser-heading"
          className="text-lg font-semibold tracking-normal"
        >
          {heading ?? "Choose your player character"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {description ??
            "Pick the player character you want to act as in this world."}
        </p>
      </div>
      <ul className="grid gap-2" aria-label="Selectable player characters">
        {selectableCharacters.map((citizen) => (
          <PlayerCharacterChooserRow
            key={citizen.id}
            citizen={citizen}
            disabled={isPending}
            onSelect={() => handleSelect(citizen.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function PlayerCharacterChooserRow({
  citizen,
  disabled,
  onSelect,
}: {
  readonly citizen: Citizen;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}): JSX.Element {
  const settlementId = citizen.settlementId;
  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(settlementId ?? ""),
    enabled: settlementId !== null,
  });
  const settlement = settlementQuery.data ?? null;
  const settlementName = settlement?.name ?? null;
  const nationName = settlement?.nation.name ?? null;

  return (
    <li>
      <button
        type="button"
        aria-label={`Select ${citizen.name}`}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={onSelect}
      >
        <Avatar profilePhotoUrl={citizen.profilePhotoUrl} />
        <div className="grid gap-0.5">
          <span className="text-sm font-medium">{citizen.name}</span>
          <span className="text-xs text-muted-foreground">
            {settlementName === null
              ? "No settlement"
              : `Settlement: ${settlementName}`}
          </span>
          <span className="text-xs text-muted-foreground">
            {roleLabel(citizen, nationName, settlementName)}
          </span>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="pointer-events-none"
        >
          <span>Select</span>
        </Button>
      </button>
    </li>
  );
}

function Avatar({
  profilePhotoUrl,
}: {
  readonly profilePhotoUrl: string | null;
}): JSX.Element {
  if (profilePhotoUrl !== null && profilePhotoUrl !== "") {
    return (
      <img
        alt=""
        aria-hidden="true"
        className="size-10 rounded-full object-cover"
        src={profilePhotoUrl}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"
    >
      <UserCircle2 className="size-6" />
    </span>
  );
}

function roleLabel(
  citizen: Citizen,
  nationName: string | null,
  settlementName: string | null,
): string {
  switch (citizen.roleType) {
    case "none":
      return "Role: none";
    case "nation_manager":
      return `Role: Nation manager${
        nationName === null ? "" : ` — ${nationName}`
      }`;
    case "settlement_manager":
      return `Role: Settlement manager${
        settlementName === null ? "" : ` — ${settlementName}`
      }`;
  }
}
