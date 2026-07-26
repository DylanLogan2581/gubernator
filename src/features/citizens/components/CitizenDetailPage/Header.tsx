import { DetailPageHeader } from "@/components/shared/DetailPageHeader";

import { CitizenAvatar } from "../CitizenAvatar";

import { DeathCategoryChip, StatusChip, TypeChip } from "./Shared";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenDetailHeader({
  citizen,
}: {
  readonly citizen: Citizen;
}): JSX.Element {
  const description =
    citizen.citizenType === "npc"
      ? "Non-player character."
      : "Player character.";

  return (
    <DetailPageHeader
      media={
        <CitizenAvatar
          id={citizen.id}
          name={citizen.name}
          profilePhotoUrl={citizen.profilePhotoUrl}
          size="lg"
        />
      }
      title={citizen.name}
      context={
        <span className="flex flex-col gap-1">
          <span>{description}</span>
          {citizen.status === "dead" && citizen.deathCause !== null ? (
            <span>{citizen.deathCause}</span>
          ) : null}
        </span>
      }
      actions={
        <>
          <StatusChip status={citizen.status} />
          <TypeChip citizenType={citizen.citizenType} />
          {citizen.status === "dead" && citizen.deathCauseCategory !== null ? (
            <DeathCategoryChip category={citizen.deathCauseCategory} />
          ) : null}
        </>
      }
    />
  );
}
