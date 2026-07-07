import { useQuery } from "@tanstack/react-query";
import { Globe2 } from "lucide-react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { getErrorDescription } from "@/lib/errorUtils";

import { allWorldsForSuperadminQueryOptions } from "../queries/superadminQueries";

import { PruneWorldDataPanel } from "./PruneWorldDataPanel";
import { WorldCascadeDeletePanel } from "./WorldCascadeDeletePanel";

import type { JSX } from "react";

export function SuperadminWorldsPanel(): JSX.Element {
  const worldsQuery = useQuery(allWorldsForSuperadminQueryOptions());

  return (
    <>
      <PageHeader
        icon={Globe2}
        title="Worlds"
        description="Prune stale turn data or permanently delete trashed worlds."
      />

      {worldsQuery.isPending && <LoadingState label="Loading worlds…" />}

      {worldsQuery.isError && (
        <ErrorState
          title="Could not load worlds"
          description={getErrorDescription(worldsQuery.error)}
        />
      )}

      {worldsQuery.isSuccess && (
        <>
          <WorldCascadeDeletePanel />
          <PruneWorldDataPanel worlds={worldsQuery.data} />
        </>
      )}
    </>
  );
}
