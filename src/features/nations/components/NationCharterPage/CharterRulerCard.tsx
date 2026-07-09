import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { type JSX } from "react";

import { Card } from "@/components/ui/card";
import {
  CitizenAvatar,
  managerScopeLabel,
  playerCharactersInNationQueryOptions,
} from "@/features/citizens";

import type { Nation } from "../../types/nationTypes";

// Ruler title flavor per government type (#1122 charter showpiece) --
// display-only, distinct from the office_types registry (#1114) which
// covers appointable offices, not the nation_manager role itself.
function rulerTitleForGovernment(
  governmentType: Nation["governmentType"],
): string {
  switch (governmentType) {
    case "monarchy":
      return "Monarch";
    case "republic":
      return "Head of State";
    case "theocracy":
      return "High Priest";
    case "tribal_council":
      return "Chief";
    case "confederation":
      return "Chairperson";
    case "despotism":
      return "Despot";
    default:
      return "Ruler";
  }
}

export function CharterRulerCard({
  nation,
}: {
  readonly nation: Nation;
}): JSX.Element {
  const citizensQuery = useQuery(
    playerCharactersInNationQueryOptions(nation.id),
  );
  const ruler =
    citizensQuery.data?.find(
      (citizen) =>
        managerScopeLabel(citizen.roleType) === "nation" &&
        citizen.roleNationId === nation.id,
    ) ?? null;
  const title = rulerTitleForGovernment(nation.governmentType);

  return (
    <Card
      aria-labelledby="nation-charter-ruler-heading"
      className="grid gap-3 p-4"
    >
      <div className="flex items-center gap-2">
        <Crown aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="nation-charter-ruler-heading" className="text-base font-medium">
          {title}
        </h2>
      </div>
      {citizensQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : ruler === null ? (
        <p className="text-sm italic text-muted-foreground">
          The office of {title.toLowerCase()} is currently vacant.
        </p>
      ) : (
        <Link
          to="/worlds/$worldId/citizens/$citizenId"
          params={{ citizenId: ruler.id, worldId: nation.worldId }}
          className="flex items-center gap-3"
        >
          <CitizenAvatar
            id={ruler.id}
            name={ruler.name}
            profilePhotoUrl={ruler.profilePhotoUrl}
          />
          <span className="text-sm font-medium underline-offset-4 hover:underline">
            {ruler.name}
          </span>
        </Link>
      )}
    </Card>
  );
}
