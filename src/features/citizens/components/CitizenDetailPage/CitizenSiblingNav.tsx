import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { citizensInSettlementQueryOptions } from "../../queries/citizensQueries";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenSiblingNav({
  citizen,
  worldId,
}: {
  readonly citizen: Citizen;
  readonly worldId: string;
}): JSX.Element | null {
  const settlementId = citizen.settlementId;
  const siblingsQuery = useQuery({
    ...citizensInSettlementQueryOptions(settlementId ?? ""),
    enabled: settlementId !== null,
  });

  const siblings = siblingsQuery.data ?? [];
  const index = siblings.findIndex((sibling) => sibling.id === citizen.id);

  if (siblings.length <= 1 || index === -1) {
    return null;
  }

  const previous = siblings[(index - 1 + siblings.length) % siblings.length];
  const next = siblings[(index + 1) % siblings.length];

  return (
    <nav
      aria-label="Citizen navigation"
      className="flex flex-wrap items-center gap-2"
    >
      <Button asChild size="sm" variant="outline">
        <Link
          params={{ citizenId: previous.id, worldId }}
          to="/worlds/$worldId/citizens/$citizenId"
        >
          <ArrowLeft aria-hidden="true" />
          {previous.name}
        </Link>
      </Button>
      <span className="text-xs text-muted-foreground">
        {index + 1} of {siblings.length}
      </span>
      <Button asChild size="sm" variant="outline">
        <Link
          params={{ citizenId: next.id, worldId }}
          to="/worlds/$worldId/citizens/$citizenId"
        >
          {next.name}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </nav>
  );
}
