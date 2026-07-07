import { useNavigate } from "@tanstack/react-router";
import { useEffect, type JSX } from "react";

import { LoadingState } from "@/components/shared/LoadingState";

// Used by section routes gated to admins/managers (settings, government) —
// mirrors HiddenNationRedirect, but renders inside the already-mounted
// NationDetailFrame/header (provided by the parent route), so it doesn't
// need to re-establish the frame itself.
export function NationSectionRedirect({
  nationId,
  worldId,
}: {
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({
      params: { nationId, worldId },
      replace: true,
      to: "/worlds/$worldId/nations/$nationId",
    });
  }, [navigate, nationId, worldId]);

  return <LoadingState label="Redirecting…" />;
}
