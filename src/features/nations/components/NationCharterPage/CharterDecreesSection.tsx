import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Card } from "@/components/ui/card";
import { nationDecreesQueryOptions } from "@/features/decrees";
import { getErrorDescription } from "@/lib/errorUtils";

const DECREE_EXCERPT_COUNT = 5;

export function CharterDecreesSection({
  nationId,
  worldId,
}: {
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  const decreesQuery = useQuery(nationDecreesQueryOptions(nationId, 0));

  return (
    <section
      className="grid gap-3"
      aria-labelledby="nation-charter-decrees-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Megaphone
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2
            id="nation-charter-decrees-heading"
            className="text-base font-medium"
          >
            Decree log
          </h2>
        </div>
        <Link
          to="/worlds/$worldId/nations/$nationId/government"
          params={{ nationId, worldId }}
          className="text-sm underline-offset-4 hover:underline"
        >
          View full log
        </Link>
      </div>

      {decreesQuery.isPending ? (
        <LoadingState label="Loading decrees…" />
      ) : decreesQuery.isError ? (
        <ErrorState
          title="Decrees could not be loaded"
          description={getErrorDescription(decreesQuery.error)}
        />
      ) : decreesQuery.data.decrees.length === 0 ? (
        <EmptyState
          title="No decrees"
          description="This nation has not issued any proclamations."
        />
      ) : (
        <div className="grid gap-2">
          {decreesQuery.data.decrees
            .slice(0, DECREE_EXCERPT_COUNT)
            .map((decree) => (
              <Card key={decree.id} className="grid gap-1 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{decree.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    Turn {decree.issuedTurnNumber}
                    {decree.revokedTurnNumber !== null ? " · Revoked" : ""}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {decree.bodyMarkdown}
                </p>
              </Card>
            ))}
        </div>
      )}
    </section>
  );
}
