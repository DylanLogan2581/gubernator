import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, type JSX } from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { useActivePlayerCharacter } from "@/features/permissions";
import { settlementByIdQueryOptions } from "@/features/settlements";

import { CitizenDetailFrame } from "./CitizenDetailFrame";

import type { Citizen } from "../../types/citizenTypes";

// Per the feature guide, Nation Manager and Settlement Manager do not reach
// the citizen detail screen — bounce them to settlement detail with an
// explanation. The redirect needs the nationId for the URL, which only the
// settlement row carries, so we wait on that lookup before navigating.
export function CitizenManagerRedirect({
  citizen,
  worldId,
}: {
  readonly citizen: Citizen;
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();
  const { activeCharacter } = useActivePlayerCharacter();
  const settlementId = citizen.settlementId;
  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(settlementId ?? ""),
    enabled: settlementId !== null && settlementId !== "",
  });
  const settlement = settlementQuery.data ?? null;
  const nationId = settlement?.nationId ?? null;

  const isManager =
    activeCharacter !== null &&
    (activeCharacter.roleType === "nation_manager" ||
      activeCharacter.roleType === "settlement_manager");

  useEffect(() => {
    if (settlementId === null || nationId === null) {
      return;
    }
    void navigate({
      params: { nationId, settlementId, worldId },
      replace: true,
      to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
    });
  }, [navigate, nationId, settlementId, worldId]);

  function redirectDescription(): string {
    if (settlementId === null) {
      return "This citizen has not been assigned to a settlement yet.";
    }
    if (isManager) {
      return "Nation and settlement managers manage citizens from the settlement detail screen. Redirecting now…";
    }
    return "Citizen detail is only available for your own living character. You will be redirected to the settlement view.";
  }

  return (
    <CitizenDetailFrame worldId={worldId}>
      <AccessDeniedState
        title="Citizen detail not available"
        description={redirectDescription()}
      />
    </CitizenDetailFrame>
  );
}
