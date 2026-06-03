import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { citizenByIdQueryOptions } from "../../queries/citizensQueries";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenParentsSection({
  citizen,
}: {
  readonly citizen: Citizen;
}): JSX.Element {
  const parentAQuery = useQuery({
    ...citizenByIdQueryOptions(citizen.parentACitizenId ?? ""),
    enabled: citizen.parentACitizenId !== null,
  });
  const parentBQuery = useQuery({
    ...citizenByIdQueryOptions(citizen.parentBCitizenId ?? ""),
    enabled: citizen.parentBCitizenId !== null,
  });

  const parents = [
    {
      label: "Parent A",
      parentId: citizen.parentACitizenId,
      name: parentAQuery.data?.name ?? null,
    },
    {
      label: "Parent B",
      parentId: citizen.parentBCitizenId,
      name: parentBQuery.data?.name ?? null,
    },
  ];

  return (
    <section
      aria-labelledby="citizen-parents-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="citizen-parents-heading" className="text-base font-medium">
        Parents
      </h2>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {parents.map(({ label, parentId, name }) => (
          <div
            key={label}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm">
              {parentId === null ? (
                <span className="text-muted-foreground">—</span>
              ) : name !== null ? (
                <Link
                  params={{ citizenId: parentId, worldId: citizen.worldId }}
                  to="/worlds/$worldId/citizens/$citizenId"
                >
                  {name}
                </Link>
              ) : (
                <span className="italic text-muted-foreground">Loading…</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
