import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Citizen } from "@/features/citizens";

import { ActivePlayerCharacterContext } from "../context/activePlayerCharacterContext";

import { ActiveCharacterSwitcher } from "./ActiveCharacterSwitcher";

import type { ActivePlayerCharacterContextValue } from "../context/activePlayerCharacterContext";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("ActiveCharacterSwitcher", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    requireSupabaseClient.mockReturnValue(createSettlementClient());
  });

  it("renders the World Admin badge when admin has no active character", () => {
    renderSwitcher({
      activeCharacter: null,
      canAdmin: true,
      selectableCharacters: [],
    });

    expect(screen.getByLabelText("Acting as World Admin")).toBeDefined();
    expect(screen.getByText("World Admin")).toBeDefined();
  });

  it("renders nothing when there is no active character and the user is not admin", () => {
    const { container } = renderSwitcher({
      activeCharacter: null,
      canAdmin: false,
      selectableCharacters: [],
    });

    expect(container.textContent).toBe("");
  });

  it("renders a static indicator when there is exactly one selectable character", () => {
    const pc = createCitizen({ id: "pc-1", name: "Solo" });
    renderSwitcher({
      activeCharacter: pc,
      canAdmin: false,
      selectableCharacters: [pc],
    });

    expect(screen.getByLabelText("Active player character")).toBeDefined();
    expect(screen.getByText("Solo")).toBeDefined();
    // No menu trigger when there is nothing to switch to.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens a switcher and calls switchTo when selecting another character", async () => {
    const pcA = createCitizen({ id: "pc-a", name: "Alpha" });
    const pcB = createCitizen({ id: "pc-b", name: "Bravo" });
    const switchTo = vi.fn();
    renderSwitcher({
      activeCharacter: pcA,
      canAdmin: false,
      selectableCharacters: [pcA, pcB],
      switchTo,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));

    expect(await screen.findByText("Switch character")).toBeDefined();
    await user.click(screen.getByRole("menuitem", { name: /Bravo/ }));

    await waitFor(() => {
      expect(switchTo).toHaveBeenCalledWith("pc-b");
    });
  });

  it("does not call switchTo when selecting the already-active character", async () => {
    const pcA = createCitizen({ id: "pc-a", name: "Alpha" });
    const pcB = createCitizen({ id: "pc-b", name: "Bravo" });
    const switchTo = vi.fn();
    renderSwitcher({
      activeCharacter: pcA,
      canAdmin: false,
      selectableCharacters: [pcA, pcB],
      switchTo,
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));

    // The active row is disabled and shouldn't fire onSelect.
    const activeItem = screen.getByRole("menuitem", { name: /Alpha/ });
    expect(activeItem.getAttribute("aria-disabled")).toBe("true");
    expect(switchTo).not.toHaveBeenCalled();
  });
});

type RenderOptions = {
  readonly activeCharacter: Citizen | null;
  readonly canAdmin: boolean;
  readonly selectableCharacters: readonly Citizen[];
  readonly switchTo?: (id: string) => void;
};

function renderSwitcher({
  activeCharacter,
  canAdmin,
  selectableCharacters,
  switchTo = (): void => {},
}: RenderOptions): ReturnType<typeof render> {
  const value: ActivePlayerCharacterContextValue = {
    activeCharacter,
    clear: (): void => {},
    isPending: false,
    selectableCharacters,
    switchTo,
  };

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ActivePlayerCharacterContext value={value}>
        <ActiveCharacterSwitcher canAdmin={canAdmin} />
      </ActivePlayerCharacterContext>
    </QueryClientProvider>,
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
    deathCause: null,
    id: "pc-1",
    name: "Player",
    npcFlaw: null,
    npcGoal: null,
    npcSecretContradiction: null,
    npcTrait1: null,
    npcTrait2: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    personalityText: null,
    profilePhotoUrl: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId: null,
    sex: null,
    skillsText: null,
    status: "alive",
    updatedAt: "2026-05-01T00:00:00.000Z",
    userId: "user-1",
    worldId: "world-1",
    ...overrides,
  } satisfies Citizen;
}

function createSettlementClient(): unknown {
  // The role label may query settlements for settlement_manager PCs. Provide
  // a noop client that returns no settlement so the label falls back cleanly.
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
