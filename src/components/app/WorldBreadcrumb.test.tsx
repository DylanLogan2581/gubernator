import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SettlementWithNation } from "@/features/settlements";

import { WorldBreadcrumb } from "./WorldBreadcrumb";
import {
  buildSegments,
  type BuildSegmentsInput,
} from "./WorldBreadcrumb.utils";

import type { ReactNode } from "react";

// ── Mock @tanstack/react-router ──────────────────────────────────────────────

const { useParams } = vi.hoisted(() => ({
  useParams: vi.fn<() => Record<string, string | undefined>>(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    to,
  }: {
    readonly children: ReactNode;
    readonly params?: Readonly<Record<string, string>>;
    readonly to: string;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    return <a href={href}>{children}</a>;
  },
  useParams,
}));

// ── Mock Supabase (no actual DB calls in these tests) ────────────────────────

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderBreadcrumb(worldId: string, worldName: string): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <WorldBreadcrumb worldId={worldId} worldName={worldName} />
    </QueryClientProvider>,
  );
}

function makeSettlement(
  overrides: Partial<SettlementWithNation> = {},
): SettlementWithNation {
  return {
    coordX: null,
    coordZ: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    id: "settlement-1",
    name: "Amberhold",
    namesetId: null,
    nation: {
      id: "nation-1",
      name: "Ironmark",
      namesetId: null,
      worldId: "world-1",
    },
    nationId: "nation-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<BuildSegmentsInput> = {},
): BuildSegmentsInput {
  return {
    worldId: "world-1",
    worldName: "Verdant Reach",
    nationId: null,
    settlementId: null,
    citizenId: null,
    nationData: null,
    settlementData: null,
    citizenName: null,
    citizenSettlementData: null,
    isCitizenPending: false,
    ...overrides,
  };
}

// ── buildSegments unit tests ─────────────────────────────────────────────────

describe("buildSegments", () => {
  describe("world depth", () => {
    it("returns a single current segment with the world name", () => {
      const segments = buildSegments(baseInput());
      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        kind: "current",
        label: "Verdant Reach",
      });
    });
  });

  describe("nation depth", () => {
    it("returns world link + current nation when name is loaded", () => {
      const segments = buildSegments(
        baseInput({
          nationId: "nation-1",
          nationData: { name: "Ironmark" },
        }),
      );
      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        kind: "world-link",
        label: "Verdant Reach",
        worldId: "world-1",
      });
      expect(segments[1]).toEqual({ kind: "current", label: "Ironmark" });
    });

    it("shows … placeholder while nation name is loading", () => {
      const segments = buildSegments(
        baseInput({ nationId: "nation-1", nationData: null }),
      );
      expect(segments[1]).toEqual({ kind: "current", label: "…" });
    });
  });

  describe("settlement depth", () => {
    it("returns world link + nation link + current settlement when loaded", () => {
      const settlement = makeSettlement();
      const segments = buildSegments(
        baseInput({
          nationId: "nation-1",
          settlementId: "settlement-1",
          settlementData: settlement,
        }),
      );
      expect(segments).toHaveLength(3);
      expect(segments[0]).toEqual({
        kind: "world-link",
        label: "Verdant Reach",
        worldId: "world-1",
      });
      expect(segments[1]).toEqual({
        kind: "nation-link",
        label: "Ironmark",
        worldId: "world-1",
        nationId: "nation-1",
      });
      expect(segments[2]).toEqual({ kind: "current", label: "Amberhold" });
    });

    it("shows … placeholders while settlement data is loading", () => {
      const segments = buildSegments(
        baseInput({
          nationId: "nation-1",
          settlementId: "settlement-1",
          settlementData: null,
        }),
      );
      expect(segments[1]).toEqual({
        kind: "nation-link",
        label: "…",
        worldId: "world-1",
        nationId: "nation-1",
      });
      expect(segments[2]).toEqual({ kind: "current", label: "…" });
    });
  });

  describe("citizen depth", () => {
    it("returns world + nation + settlement + current citizen when fully loaded", () => {
      const settlement = makeSettlement();
      const segments = buildSegments(
        baseInput({
          citizenId: "citizen-1",
          citizenName: "Aldric Stonewall",
          citizenSettlementData: settlement,
        }),
      );
      expect(segments).toHaveLength(4);
      expect(segments[0]).toEqual({
        kind: "world-link",
        label: "Verdant Reach",
        worldId: "world-1",
      });
      expect(segments[1]).toEqual({
        kind: "nation-link",
        label: "Ironmark",
        worldId: "world-1",
        nationId: "nation-1",
      });
      expect(segments[2]).toEqual({
        kind: "settlement-link",
        label: "Amberhold",
        worldId: "world-1",
        nationId: "nation-1",
        settlementId: "settlement-1",
      });
      expect(segments[3]).toEqual({
        kind: "current",
        label: "Aldric Stonewall",
      });
    });

    it("returns world + current citizen only when citizen has no settlement", () => {
      const segments = buildSegments(
        baseInput({
          citizenId: "citizen-1",
          citizenName: "Wanderer",
          citizenSettlementData: null,
          isCitizenPending: false,
        }),
      );
      expect(segments).toHaveLength(2);
      expect(segments[1]).toEqual({ kind: "current", label: "Wanderer" });
    });

    it("shows … while citizen is still loading", () => {
      const segments = buildSegments(
        baseInput({
          citizenId: "citizen-1",
          isCitizenPending: true,
        }),
      );
      expect(segments).toHaveLength(2);
      expect(segments[1]).toEqual({ kind: "current", label: "…" });
    });
  });
});

// ── WorldBreadcrumb render tests ─────────────────────────────────────────────

describe("WorldBreadcrumb", () => {
  beforeEach(() => {
    useParams.mockReturnValue({});
  });

  it("renders world name as plain text on the world page", () => {
    renderBreadcrumb("world-1", "Verdant Reach");

    expect(screen.getByText("Verdant Reach")).toBeDefined();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("has the correct aria-label on its nav element", () => {
    renderBreadcrumb("world-1", "Verdant Reach");

    expect(
      screen.getByRole("navigation", { name: "World navigation breadcrumb" }),
    ).toBeDefined();
  });

  it("renders world name as a link on the nation page", () => {
    useParams.mockReturnValue({ worldId: "world-1", nationId: "nation-1" });
    renderBreadcrumb("world-1", "Verdant Reach");

    const worldLink = screen.getByRole("link", { name: "Verdant Reach" });
    expect(worldLink).toHaveAttribute("href", "/worlds/world-1");
  });

  it("renders nation name as plain text (current) on the nation page", () => {
    useParams.mockReturnValue({ worldId: "world-1", nationId: "nation-1" });
    renderBreadcrumb("world-1", "Verdant Reach");

    // Loading placeholder while queries are disabled
    expect(screen.getByText("…")).toBeDefined();
    expect(screen.queryByRole("link", { name: "…" })).toBeNull();
  });

  it("renders world link, nation link, and settlement text on the settlement page", () => {
    useParams.mockReturnValue({
      worldId: "world-1",
      nationId: "nation-1",
      settlementId: "settlement-1",
    });
    renderBreadcrumb("world-1", "Verdant Reach");

    const worldLink = screen.getByRole("link", { name: "Verdant Reach" });
    expect(worldLink).toHaveAttribute("href", "/worlds/world-1");
    // nation link renders as "…" while loading
    const nationLink = screen.getByRole("link", { name: "…" });
    expect(nationLink).toHaveAttribute(
      "href",
      "/worlds/world-1/nations/nation-1",
    );
  });

  it("renders world link and citizen placeholder on the citizen page", () => {
    useParams.mockReturnValue({ worldId: "world-1", citizenId: "citizen-1" });
    renderBreadcrumb("world-1", "Verdant Reach");

    const worldLink = screen.getByRole("link", { name: "Verdant Reach" });
    expect(worldLink).toHaveAttribute("href", "/worlds/world-1");
    // Loading placeholder for citizen name
    expect(screen.getByText("…")).toBeDefined();
  });

  it("does not show 'Active world' static text", () => {
    renderBreadcrumb("world-1", "Verdant Reach");

    expect(screen.queryByText("Active world")).toBeNull();
  });
});
