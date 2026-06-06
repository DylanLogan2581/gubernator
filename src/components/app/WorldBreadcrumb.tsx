import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { type JSX } from "react";

import { citizenByIdQueryOptions } from "@/features/citizens";
import { nationByIdQueryOptions } from "@/features/nations";
import { settlementByIdQueryOptions } from "@/features/settlements";

import { buildSegments } from "./WorldBreadcrumb.utils";

import type { BreadcrumbSegment } from "./WorldBreadcrumb.utils";

type WorldBreadcrumbProps = {
  readonly worldId: string;
  readonly worldName: string;
};

export function WorldBreadcrumb({
  worldId,
  worldName,
}: WorldBreadcrumbProps): JSX.Element {
  const routeParams = useParams({ strict: false });
  const nationId = routeParams.nationId ?? null;
  const settlementId = routeParams.settlementId ?? null;
  const citizenId = routeParams.citizenId ?? null;

  const onNationPage =
    nationId !== null && settlementId === null && citizenId === null;
  const onSettlementPage = settlementId !== null && citizenId === null;
  const onCitizenPage = citizenId !== null;

  const nationQuery = useQuery({
    ...nationByIdQueryOptions(nationId ?? ""),
    enabled: onNationPage,
  });

  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(settlementId ?? ""),
    enabled: onSettlementPage,
  });

  const citizenQuery = useQuery({
    ...citizenByIdQueryOptions(citizenId ?? ""),
    enabled: onCitizenPage,
  });

  const citizenSettlementId = onCitizenPage
    ? (citizenQuery.data?.settlementId ?? null)
    : null;
  const citizenSettlementQuery = useQuery({
    ...settlementByIdQueryOptions(citizenSettlementId ?? ""),
    enabled: onCitizenPage && citizenSettlementId !== null,
  });

  const segments = buildSegments({
    worldId,
    worldName,
    nationId,
    settlementId,
    citizenId,
    nationData: onNationPage ? (nationQuery.data ?? null) : null,
    settlementData: onSettlementPage ? (settlementQuery.data ?? null) : null,
    citizenName: onCitizenPage ? (citizenQuery.data?.name ?? null) : null,
    citizenSettlementData: onCitizenPage
      ? (citizenSettlementQuery.data ?? null)
      : null,
    isCitizenPending: onCitizenPage && citizenQuery.isPending,
  });

  return (
    <nav aria-label="World navigation breadcrumb">
      <ol className="flex min-w-0 items-center gap-1">
        {segments.map((segment, index) => (
          <li
            key={segment.kind}
            className={
              index === segments.length - 1
                ? "flex min-w-0 items-center gap-1"
                : "flex shrink-0 items-center gap-1"
            }
          >
            {index > 0 && (
              <ChevronRight aria-hidden="true" className="size-3 opacity-50" />
            )}
            {renderSegment(segment)}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function renderSegment(segment: BreadcrumbSegment): JSX.Element {
  switch (segment.kind) {
    case "world-link":
      return (
        <Link
          to="/worlds/$worldId"
          params={{ worldId: segment.worldId }}
          className="transition-colors hover:text-foreground"
        >
          {segment.label}
        </Link>
      );
    case "nation-link":
      return (
        <Link
          to="/worlds/$worldId/nations/$nationId"
          params={{ worldId: segment.worldId, nationId: segment.nationId }}
          className="transition-colors hover:text-foreground"
        >
          {segment.label}
        </Link>
      );
    case "settlement-link":
      return (
        <Link
          to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
          params={{
            worldId: segment.worldId,
            nationId: segment.nationId,
            settlementId: segment.settlementId,
          }}
          className="transition-colors hover:text-foreground"
        >
          {segment.label}
        </Link>
      );
    case "current":
      return <span>{segment.label}</span>;
  }
}
