import { StatusChip, TypeChip } from "./Shared";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenDetailHeader({
  citizen,
}: {
  readonly citizen: Citizen;
}): JSX.Element {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            {citizen.name}
          </h1>
          <StatusChip status={citizen.status} />
          <TypeChip citizenType={citizen.citizenType} />
        </div>
        <p className="text-sm text-muted-foreground">
          {citizen.citizenType === "npc"
            ? "Non-player character."
            : "Player character."}
        </p>
      </div>
    </header>
  );
}
