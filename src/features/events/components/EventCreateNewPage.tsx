import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import {
  currentAccessContextQueryOptions,
  type AccessContext,
} from "@/features/permissions";

import { EventCreateWizard } from "./EventCreateWizard";

import type { JSX } from "react";

type EventCreateNewPageProps = {
  readonly worldId: string;
};

export function EventCreateNewPage({
  worldId,
}: EventCreateNewPageProps): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  const handleClose = (): void => {
    void navigate({
      to: "/worlds/$worldId/events",
      params: { worldId },
    });
  };

  if (accessContextQuery.isPending) {
    return <div>Loading...</div>;
  }

  if (accessContextQuery.isError) {
    return <div>Error loading access context</div>;
  }

  const accessContext: AccessContext = accessContextQuery.data;

  return (
    <EventCreateWizard
      accessContext={accessContext}
      worldId={worldId}
      onClose={handleClose}
    />
  );
}
