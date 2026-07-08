import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Citizen } from "@/features/citizens";

import { ActivePlayerCharacterContext } from "../context/activePlayerCharacterContext";

import { ActiveCharacterSwitcher } from "./ActiveCharacterSwitcher";

import type { ActivePlayerCharacterContextValue } from "../context/activePlayerCharacterContext";
import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    "aria-label": ariaLabel,
    children,
    className,
    params,
    to,
  }: {
    readonly "aria-label"?: string;
    readonly children: ReactNode;
    readonly className?: string;
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
    return (
      <a aria-label={ariaLabel} className={className} href={href}>
        {children}
      </a>
    );
  },
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

  it("renders a link to the citizen detail when there is exactly one selectable character", () => {
    const pc = createCitizen({ id: "pc-1", name: "Solo" });
    renderSwitcher({
      activeCharacter: pc,
      canAdmin: false,
      selectableCharacters: [pc],
    });

    const link = screen.getByLabelText("Active player character");
    expect(link).toBeDefined();
    expect(link).toHaveAttribute("href", "/worlds/world-42/citizens/pc-1");
    expect(screen.getByText("Solo")).toBeDefined();
    // No dropdown trigger or clear button for a non-admin with nothing to
    // switch to and no admin access to restore.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows an admin-paused badge and an Admin menu entry when an admin has an active character", async () => {
    const pc = createCitizen({ id: "pc-1", name: "Solo" });
    const clear = vi.fn();
    renderSwitcher({
      activeCharacter: pc,
      canAdmin: true,
      clear,
      selectableCharacters: [pc],
    });

    expect(screen.getByLabelText("Admin access paused")).toBeDefined();
    expect(screen.getByText("Admin paused")).toBeDefined();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch character" }));
    await user.click(screen.getByRole("menuitem", { name: "Admin" }));
    expect(clear).toHaveBeenCalled();
  });

  it("offers an Admin menu entry alongside the only character (issue #978 repro)", async () => {
    const pc = createCitizen({ id: "pc-1", name: "Solo" });
    const clear = vi.fn();
    const switchTo = vi.fn();
    renderSwitcher({
      activeCharacter: null,
      canAdmin: true,
      clear,
      selectableCharacters: [pc],
      switchTo,
    });

    // With admin mode active (no active character) but a character available
    // to switch to, the switcher must still expose a menu rather than the
    // static World Admin badge — otherwise there's no way back to the PC.
    expect(screen.getByText("World Admin")).toBeDefined();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch character" }));

    const adminItem = screen.getByRole("menuitem", { name: /Admin/ });
    expect(adminItem.getAttribute("aria-disabled")).toBe("true");

    await user.click(screen.getByRole("menuitem", { name: /Solo/ }));
    expect(switchTo).toHaveBeenCalledWith("pc-1");
  });

  it("does not show an Admin menu entry for non-admin viewers", async () => {
    const pcA = createCitizen({ id: "pc-a", name: "Alpha" });
    const pcB = createCitizen({ id: "pc-b", name: "Bravo" });
    renderSwitcher({
      activeCharacter: pcA,
      canAdmin: false,
      selectableCharacters: [pcA, pcB],
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch character" }));

    expect(screen.queryByRole("menuitem", { name: "Admin" })).toBeNull();
  });

  it("renders a link to citizen detail alongside the switcher for multiple characters", () => {
    const pcA = createCitizen({ id: "pc-a", name: "Alpha" });
    const pcB = createCitizen({ id: "pc-b", name: "Bravo" });
    renderSwitcher({
      activeCharacter: pcA,
      canAdmin: false,
      selectableCharacters: [pcA, pcB],
    });

    // The name area should be a link to the active PC's detail page.
    const links = screen.getAllByRole("link");
    expect(
      links.some(
        (l) => l.getAttribute("href") === "/worlds/world-42/citizens/pc-a",
      ),
    ).toBe(true);
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
    await user.click(screen.getByRole("button", { name: "Switch character" }));

    expect(await screen.findByText("Switch character")).toBeDefined();
    await user.click(screen.getByRole("menuitem", { name: /Bravo/ }));

    await waitFor(() => {
      expect(switchTo).toHaveBeenCalledWith("pc-b");
    });
  });

  it("shows 'None' as the role label for a player character with roleType 'none'", () => {
    const pc = createCitizen({ id: "pc-1", name: "Solo", roleType: "none" });
    renderSwitcher({
      activeCharacter: pc,
      canAdmin: false,
      selectableCharacters: [pc],
    });

    expect(screen.getByText("None")).toBeDefined();
    expect(screen.queryByText("Citizen")).toBeNull();
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
    await user.click(screen.getByRole("button", { name: "Switch character" }));

    // The active row is disabled and shouldn't fire onSelect.
    const activeItem = screen.getByRole("menuitem", { name: /Alpha/ });
    expect(activeItem.getAttribute("aria-disabled")).toBe("true");
    expect(switchTo).not.toHaveBeenCalled();
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

function renderSwitcher({
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
    <QueryClientProvider client={createQueryClient()}>
      <ActivePlayerCharacterContext value={value}>
        <ActiveCharacterSwitcher canAdmin={canAdmin} worldId={worldId} />
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
