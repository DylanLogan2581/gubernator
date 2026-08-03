import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { AdminPausedHint, useEffectiveCanAdmin } from "@/features/permissions";
import type { WorldRouteAccess } from "@/features/worlds";
import { notifyMutationSuccess } from "@/lib/notify";

import { createNamesetMutationOptions } from "../../mutations/namesetsMutations";
import { CreateNamesetForm } from "../NamesetsConfigPanel/NamesetForm";
import { formatMutationError } from "../NamesetsConfigPanel/utils/FormatMutationError";

import { NamesetPageShell } from "./NamesetPageShell";

import type { JSX } from "react";

type NamesetCreatePageProps = {
  readonly worldId: string;
};

export function NamesetCreatePage({
  worldId,
}: NamesetCreatePageProps): JSX.Element {
  return (
    <NamesetPageShell worldId={worldId}>
      {({ worldAccess }) => (
        <NamesetCreateContent worldAccess={worldAccess} worldId={worldId} />
      )}
    </NamesetPageShell>
  );
}

function NamesetCreateContent({
  worldAccess,
  worldId,
}: {
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);
  const createMutation = useMutation(
    createNamesetMutationOptions({ queryClient }),
  );

  function goBack(): void {
    void navigate({
      to: "/worlds/$worldId/configuration",
      params: { worldId },
      search: { tab: "namesets" },
    });
  }

  const canEdit = effectiveCanAdmin && !worldAccess.header.isArchived;

  if (!canEdit) {
    return (
      <AccessDeniedState
        title="Creating unavailable"
        description="You do not have permission to create namesets in this world."
      />
    );
  }

  return (
    <>
      <AdminPausedHint canAdmin={worldAccess.canAdmin} />
      <CreateNamesetForm
        isPending={createMutation.isPending}
        onCancel={goBack}
        onSubmit={(name, configJson) => {
          createMutation.mutate(
            { worldId, name, configJson },
            {
              onError: (error) => {
                handleCrudError(error, formatMutationError(error));
              },
              onSuccess: () => {
                notifyMutationSuccess("Nameset created.");
                goBack();
              },
            },
          );
        }}
      />
    </>
  );
}
