import type { SettlementWithNation } from "@/features/settlements";

// ── Segment types ────────────────────────────────────────────────────────────

export type WorldLinkSegment = {
  readonly kind: "world-link";
  readonly label: string;
  readonly worldId: string;
};

export type NationLinkSegment = {
  readonly kind: "nation-link";
  readonly label: string;
  readonly worldId: string;
  readonly nationId: string;
};

export type SettlementLinkSegment = {
  readonly kind: "settlement-link";
  readonly label: string;
  readonly worldId: string;
  readonly nationId: string;
  readonly settlementId: string;
};

export type CurrentSegment = {
  readonly kind: "current";
  readonly label: string;
};

export type BreadcrumbSegment =
  | WorldLinkSegment
  | NationLinkSegment
  | SettlementLinkSegment
  | CurrentSegment;

// ── buildSegments ────────────────────────────────────────────────────────────

export type BuildSegmentsInput = {
  readonly worldId: string;
  readonly worldName: string;
  readonly nationId: string | null;
  readonly settlementId: string | null;
  readonly citizenId: string | null;
  readonly nationData: { readonly name: string } | null;
  readonly settlementData: SettlementWithNation | null;
  readonly citizenName: string | null;
  readonly citizenSettlementData: SettlementWithNation | null;
  readonly isCitizenPending: boolean;
};

export function buildSegments({
  worldId,
  worldName,
  nationId,
  settlementId,
  citizenId,
  nationData,
  settlementData,
  citizenName,
  citizenSettlementData,
  isCitizenPending,
}: BuildSegmentsInput): readonly BreadcrumbSegment[] {
  const worldLink: WorldLinkSegment = {
    kind: "world-link",
    label: worldName,
    worldId,
  };

  // World depth
  if (citizenId === null && settlementId === null && nationId === null) {
    return [{ kind: "current", label: worldName }];
  }

  // Nation depth (no settlement or citizen in URL params)
  if (citizenId === null && settlementId === null && nationId !== null) {
    return [worldLink, { kind: "current", label: nationData?.name ?? "…" }];
  }

  // Settlement depth
  if (citizenId === null && settlementId !== null && nationId !== null) {
    return [
      worldLink,
      {
        kind: "nation-link",
        label: settlementData?.nation.name ?? "…",
        worldId,
        nationId,
      },
      { kind: "current", label: settlementData?.name ?? "…" },
    ];
  }

  // Citizen depth
  if (citizenId !== null) {
    if (isCitizenPending) {
      return [worldLink, { kind: "current", label: "…" }];
    }

    if (citizenSettlementData !== null) {
      return [
        worldLink,
        {
          kind: "nation-link",
          label: citizenSettlementData.nation.name,
          worldId,
          nationId: citizenSettlementData.nation.id,
        },
        {
          kind: "settlement-link",
          label: citizenSettlementData.name,
          worldId,
          nationId: citizenSettlementData.nation.id,
          settlementId: citizenSettlementData.id,
        },
        { kind: "current", label: citizenName ?? "…" },
      ];
    }

    return [worldLink, { kind: "current", label: citizenName ?? "…" }];
  }

  return [{ kind: "current", label: worldName }];
}
