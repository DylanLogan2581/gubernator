import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { type JSX, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Card } from "@/components/ui/card";
import { citizensByIdsQueryOptions } from "@/features/citizens";
import {
  nationBodyResolverContextQueryOptions,
  nationGovernmentBodiesQueryOptions,
} from "@/features/government-bodies";
import { getErrorDescription } from "@/lib/errorUtils";
import { resolveBodyMembers } from "@/shared/government";

import { nationOfficesRosterQueryOptions } from "../../queries/officesQueries";

export function CharterBodiesSection({
  nationId,
}: {
  readonly nationId: string;
}): JSX.Element {
  const bodiesQuery = useQuery(nationGovernmentBodiesQueryOptions(nationId));
  const resolverContextQuery = useQuery(
    nationBodyResolverContextQueryOptions(nationId),
  );
  const officesRosterQuery = useQuery(
    nationOfficesRosterQueryOptions(nationId),
  );

  const bodies = bodiesQuery.data ?? [];
  const explicitCitizenIds = [
    ...new Set(
      bodies.flatMap((body) =>
        body.composition.flatMap((rule) =>
          rule.kind === "citizens" ? rule.citizenIds : [],
        ),
      ),
    ),
  ];
  const explicitCitizensQuery = useQuery(
    citizensByIdsQueryOptions(explicitCitizenIds),
  );

  if (
    bodiesQuery.isPending ||
    resolverContextQuery.isPending ||
    officesRosterQuery.isPending ||
    (explicitCitizensQuery.isPending && explicitCitizenIds.length > 0)
  ) {
    return (
      <ChapterFrame>
        <LoadingState label="Loading government bodies…" />
      </ChapterFrame>
    );
  }

  if (
    bodiesQuery.isError ||
    resolverContextQuery.isError ||
    officesRosterQuery.isError ||
    (explicitCitizensQuery.isError && explicitCitizenIds.length > 0)
  ) {
    return (
      <ChapterFrame>
        <ErrorState
          title="Bodies could not be loaded"
          description={getErrorDescription(
            bodiesQuery.error ??
              resolverContextQuery.error ??
              officesRosterQuery.error ??
              explicitCitizensQuery.error,
          )}
        />
      </ChapterFrame>
    );
  }

  if (bodies.length === 0) {
    return (
      <ChapterFrame>
        <EmptyState
          title="No government bodies"
          description="This nation has not established any named governing bodies."
        />
      </ChapterFrame>
    );
  }

  const resolverContext = resolverContextQuery.data;
  const aliveExplicitCitizenIds = (explicitCitizensQuery.data ?? [])
    .filter((citizen) => citizen.status === "alive")
    .map((citizen) => citizen.id);
  const aliveCitizenIds = new Set([
    ...(resolverContext.rulerCitizenId !== null
      ? [resolverContext.rulerCitizenId]
      : []),
    ...resolverContext.settlementManagerCitizenIds,
    ...resolverContext.officeHolders.map((holder) => holder.citizenId),
    ...aliveExplicitCitizenIds,
  ]);

  const nameById = new Map(
    (explicitCitizensQuery.data ?? []).map((citizen) => [
      citizen.id,
      citizen.name,
    ]),
  );
  const officesById = new Map<string, string[]>();
  for (const office of officesRosterQuery.data ?? []) {
    nameById.set(office.citizenId, office.citizenName);
    const offices = officesById.get(office.citizenId) ?? [];
    offices.push(office.officeTypeName);
    officesById.set(office.citizenId, offices);
  }

  return (
    <ChapterFrame>
      <div className="grid gap-4 sm:grid-cols-2">
        {bodies.map((body) => {
          const memberIds = resolveBodyMembers(body, {
            aliveCitizenIds,
            officeHolders: resolverContext.officeHolders,
            rulerCitizenId: resolverContext.rulerCitizenId,
            settlementManagerCitizenIds:
              resolverContext.settlementManagerCitizenIds,
          });

          return (
            <Card key={body.id} className="grid gap-2 p-4">
              <h3 className="text-sm font-semibold">{body.name}</h3>
              {body.description !== null && body.description !== "" ? (
                <p className="text-sm text-muted-foreground">
                  {body.description}
                </p>
              ) : null}
              {memberIds.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  No current members.
                </p>
              ) : (
                <ul className="grid gap-1 text-sm">
                  {memberIds.map((citizenId) => {
                    const offices = officesById.get(citizenId);
                    return (
                      <li key={citizenId}>
                        {nameById.get(citizenId) ?? "Unknown citizen"}
                        {offices !== undefined && offices.length > 0 ? (
                          <span className="text-muted-foreground">
                            {" "}
                            — {offices.join(", ")}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </ChapterFrame>
  );
}

function ChapterFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section
      className="grid gap-3"
      aria-labelledby="nation-charter-bodies-heading"
    >
      <div className="flex items-center gap-2">
        <Landmark aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2
          id="nation-charter-bodies-heading"
          className="text-base font-medium"
        >
          Governing bodies
        </h2>
      </div>
      {children}
    </section>
  );
}
