import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Card } from "@/components/ui/card";
import { getErrorDescription } from "@/lib/errorUtils";

import { citizenFamilyTreeQueryOptions } from "../../queries/citizenFamilyTreeQueries";

import { StatusChip } from "./Shared";

import type { Citizen, FamilyTreeNode } from "../../types/citizenTypes";
import type { JSX } from "react";

const GENERATION_LABELS: Readonly<Record<number, string>> = {
  [-3]: "Great-grandparents",
  [-2]: "Grandparents",
  [-1]: "Parents",
  0: "Center & partners",
  1: "Children",
  2: "Grandchildren",
  3: "Great-grandchildren",
};

export function CitizenFamilyTreeSection({
  citizen,
}: {
  readonly citizen: Citizen;
}): JSX.Element {
  const familyTreeQuery = useQuery(citizenFamilyTreeQueryOptions(citizen.id));

  return (
    <Card
      aria-labelledby="citizen-family-tree-heading"
      className="grid gap-3 p-4"
    >
      <h2 id="citizen-family-tree-heading" className="text-base font-medium">
        Family tree
      </h2>
      <CitizenFamilyTreeBody citizen={citizen} query={familyTreeQuery} />
    </Card>
  );
}

function CitizenFamilyTreeBody({
  citizen,
  query,
}: {
  readonly citizen: Citizen;
  readonly query: ReturnType<typeof useQuery<readonly FamilyTreeNode[]>>;
}): JSX.Element {
  if (query.isPending) {
    return <LoadingState label="Loading family tree…" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Family tree could not be loaded"
        description={getErrorDescription(query.error)}
      />
    );
  }

  const nodes = query.data;
  const hasRelatives = nodes.some(
    (node) => node.nodePath !== "root" && node.direction !== "unknown",
  );

  if (!hasRelatives) {
    return (
      <EmptyState
        title="No known family recorded"
        description="No ancestors, descendants, or partners are on record for this citizen."
      />
    );
  }

  const nodesByGeneration = new Map<number, FamilyTreeNode[]>();
  for (const node of nodes) {
    const bucket = nodesByGeneration.get(node.generation) ?? [];
    bucket.push(node);
    nodesByGeneration.set(node.generation, bucket);
  }

  const generations = [...nodesByGeneration.keys()].sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="flex min-w-max gap-4 p-4">
        {generations.map((generation) => (
          <FamilyTreeGenerationColumn
            key={generation}
            citizen={citizen}
            generation={generation}
            nodes={nodesByGeneration.get(generation) ?? []}
          />
        ))}
      </div>
    </div>
  );
}

function FamilyTreeGenerationColumn({
  citizen,
  generation,
  nodes,
}: {
  readonly citizen: Citizen;
  readonly generation: number;
  readonly nodes: readonly FamilyTreeNode[];
}): JSX.Element {
  return (
    <div className="flex w-40 shrink-0 flex-col gap-2">
      <p className="text-center text-xs font-medium text-muted-foreground">
        {GENERATION_LABELS[generation] ?? `Generation ${generation}`}
      </p>
      <div className="flex flex-col justify-center gap-2">
        {nodes.map((node) => (
          <FamilyTreeNodeCard
            key={node.nodePath}
            citizen={citizen}
            node={node}
          />
        ))}
      </div>
    </div>
  );
}

function FamilyTreeNodeCard({
  citizen,
  node,
}: {
  readonly citizen: Citizen;
  readonly node: FamilyTreeNode;
}): JSX.Element {
  if (node.citizenId === null || node.name === null || node.status === null) {
    return (
      <div className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-center">
        <span className="text-sm italic text-muted-foreground">Unknown</span>
      </div>
    );
  }

  const isCurrentCitizen = node.citizenId === citizen.id;

  return (
    <div
      className={`grid gap-1 rounded-md border px-3 py-2 ${
        isCurrentCitizen
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-background"
      }`}
    >
      <Link
        className="truncate text-sm font-medium hover:underline"
        params={{ citizenId: node.citizenId, worldId: citizen.worldId }}
        to="/worlds/$worldId/citizens/$citizenId"
      >
        {node.name}
      </Link>
      <StatusChip status={node.status} />
    </div>
  );
}
