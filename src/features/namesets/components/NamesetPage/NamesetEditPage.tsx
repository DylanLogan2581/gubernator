import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { AdminPausedHint, useEffectiveCanAdmin } from "@/features/permissions";
import type { WorldRouteAccess } from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import { namesetsByWorldQueryOptions } from "../../queries/namesetsQueries";
import { EditNamesetForm } from "../NamesetsConfigPanel/NamesetForm";

import { NamesetPageShell } from "./NamesetPageShell";

import type { JSX } from "react";

type NamesetEditPageProps = {
  readonly namesetId: string;
  readonly worldId: string;
};

export function NamesetEditPage({
  namesetId,
  worldId,
}: NamesetEditPageProps): JSX.Element {
  return (
    <NamesetPageShell worldId={worldId}>
      {({ worldAccess }) => (
        <NamesetEditContent
          namesetId={namesetId}
          worldAccess={worldAccess}
          worldId={worldId}
        />
      )}
    </NamesetPageShell>
  );
}

function NamesetEditContent({
  namesetId,
  worldAccess,
  worldId,
}: {
  readonly namesetId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const namesetsQuery = useQuery(namesetsByWorldQueryOptions(worldId));
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);

  function goBack(): void {
    void navigate({
      to: "/worlds/$worldId/configuration",
      params: { worldId },
      search: { tab: "namesets" },
    });
  }

  if (namesetsQuery.isPending) {
    return <LoadingState label="Loading nameset…" />;
  }

  if (namesetsQuery.isError) {
    return (
      <ErrorState
        title="Nameset could not be loaded"
        description={getErrorDescription(namesetsQuery.error)}
      />
    );
  }

  const nameset =
    namesetsQuery.data.find((candidate) => candidate.id === namesetId) ?? null;

  if (nameset === null || nameset.isTrashed) {
    return (
      <AccessDeniedState
        title="Nameset unavailable"
        description="This nameset does not exist or is not part of this world."
      />
    );
  }

  const canEdit = effectiveCanAdmin && !worldAccess.header.isArchived;

  if (!canEdit) {
    return (
      <AccessDeniedState
        title="Editing unavailable"
        description="You do not have permission to edit namesets in this world."
      />
    );
  }

  return (
    <>
      <AdminPausedHint canAdmin={worldAccess.canAdmin} />
      <EditNamesetForm
        nameset={nameset}
        queryClient={queryClient}
        worldId={worldId}
        onClose={goBack}
      />
    </>
  );
}
