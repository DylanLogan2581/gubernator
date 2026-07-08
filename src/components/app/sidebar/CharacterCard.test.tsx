import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Citizen } from "@/features/citizens";
import { ActivePlayerCharacterContext } from "@/features/permissions";
import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { CharacterCard } from "./CharacterCard";

import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
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
}));

describe("CharacterCard", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    requireSupabaseClient.mockReturnValue(createSettlementClient());
  });

  it("renders nothing when there is no active character and the user is not admin", () => {
    const { container } = renderCard({
      activeCharacter: null,
      canAdmin: false,
      selectableCharacters: [],
    });

    expect(container.textContent).toBe("");
  });

  it("shows a static World Admin row when admin has no PCs at all", () => {
    renderCard({
      activeCharacter: null,
      canAdmin: true,
      selectableCharacters: [],
    });

    expect(screen.getByText("World Admin")).toBeDefined();
    // Static (no menu) — no dropdown trigger.
    expect(screen.queryByRole("button")).toBeNull();
    // No "Admin paused" badge anywhere (issue #1012).
    expect(screen.queryByText(/admin paused/i)).toBeNull();
  });

  it("links straight to the citizen page when there's exactly one selectable character", () => {
    const pc = createCitizen({ id: "pc-1", name: "Solo" });
    renderCard({
      activeCharacter: pc,
      canAdmin: false,
      selectableCharacters: [pc],
    });

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/worlds/world-42/citizens/pc-1");
    expect(screen.getByText("Solo")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders a full-width trigger with no Admin paused badge when an admin has an active PC", () => {
    const pc = createCitizen({ id: "pc-1", name: "Solo" });
    renderCard({
      activeCharacter: pc,
      canAdmin: true,
      selectableCharacters: [pc],
    });

    expect(screen.queryByText(/admin paused/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Solo/ })).toBeDefined();
  });

  it("opens the dropdown and clears back to admin", async () => {
    const pc = createCitizen({ id: "pc-1", name: "Solo" });
    const clear = vi.fn();
    renderCard({
      activeCharacter: pc,
      canAdmin: true,
      clear,
      selectableCharacters: [pc],
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Solo/ }));
    await user.click(screen.getByRole("menuitem", { name: "Admin" }));

    expect(clear).toHaveBeenCalled();
  });

  it("opens the dropdown and switches to another character", async () => {
    const pcA = createCitizen({ id: "pc-a", name: "Alpha" });
    const pcB = createCitizen({ id: "pc-b", name: "Bravo" });
    const switchTo = vi.fn();
    renderCard({
      activeCharacter: pcA,
      canAdmin: false,
      selectableCharacters: [pcA, pcB],
      switchTo,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    await user.click(screen.getByRole("menuitem", { name: /Bravo/ }));

    expect(switchTo).toHaveBeenCalledWith("pc-b");
  });

  it("offers an Admin menu entry alongside the only character (issue #978 repro)", async () => {
    const pc = createCitizen({ id: "pc-1", name: "Solo" });
    const clear = vi.fn();
    const switchTo = vi.fn();
    renderCard({
      activeCharacter: null,
      canAdmin: true,
      clear,
      selectableCharacters: [pc],
      switchTo,
    });

    expect(screen.getByText("World Admin")).toBeDefined();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /World Admin/ }));

    const adminItem = screen.getByRole("menuitem", { name: /Admin/ });
    expect(adminItem.getAttribute("aria-disabled")).toBe("true");

    await user.click(screen.getByRole("menuitem", { name: /Solo/ }));
    expect(switchTo).toHaveBeenCalledWith("pc-1");
  });
});

type RenderOptions = {
  readonly activeCharacter: Citizen | null;
  readonly canAdmin: boolean;
  readonly clear?: () => void;
  readonly selectableCharacters: readonly Citizen[];
  readonly switchTo?: (id: string) => void;
  readonly worldId?: string;
};

function renderCard({
  activeCharacter,
  canAdmin,
  clear = (): void => {},
  selectableCharacters,
  switchTo = (): void => {},
  worldId = "world-42",
}: RenderOptions): ReturnType<typeof render> {
  const value: ActivePlayerCharacterContextValue = {
    activeCharacter,
    clear,
    isExplicitAdminChoice: false,
    isPending: false,
    selectableCharacters,
    switchTo,
  };

  return render(
    <TooltipProvider>
      <QueryClientProvider client={createQueryClient()}>
        <SidebarProvider>
          <ActivePlayerCharacterContext value={value}>
            <CharacterCard canAdmin={canAdmin} worldId={worldId} />
          </ActivePlayerCharacterContext>
        </SidebarProvider>
      </QueryClientProvider>
    </TooltipProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function createCitizen(overrides: Partial<Citizen>): Citizen {
  return {
    bornOnTurnNumber: null,
    citizenType: "player_character",
    createdAt: "2026-05-01T00:00:00.000Z",
    cultureId: null,
    deathCause: null,
    deathCauseCategory: null,
    givenName: "Player",
    id: "pc-1",
    name: "Player",
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    profilePhotoUrl: null,
    religionId: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId: null,
    sex: null,
    status: "alive",
    surname: null,
    updatedAt: "2026-05-01T00:00:00.000Z",
    userId: "user-1",
    worldId: "world-1",
    ...overrides,
  } satisfies Citizen;
}

function createSettlementClient(): unknown {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  };
}
