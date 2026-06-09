import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";

import { NationDetailPage } from "./NationDetailPage";

import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
  toastSuccess:
    vi.fn<(message: string, options?: { description?: string }) => void>(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: Readonly<Record<string, string>>;
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
  useNavigate: () => navigateMock,
}));

vi.mock(
  "@/features/settlements/mutations/settlementReadinessMutations",
  () => ({
    setSettlementReadinessMutationOptions: vi.fn(
      () =>
        ({
          mutationFn: vi.fn().mockResolvedValue({}),
        }) as never,
    ),
  }),
);

const worldId = "00000000-0000-0000-0000-000000000101";
const nationId = "11111111-1111-1111-1111-111111111111";
const otherNationId = "22222222-2222-2222-2222-222222222222";

describe("NationDetailPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    navigateMock.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("renders nation name, description, and a back link to the nations list", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({
            description: "A mountain realm.",
            name: "Highmark",
          }),
        ],
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Highmark" }),
    ).toBeDefined();
    expect(screen.getByText("A mountain realm.")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Back to nations" }),
    ).toHaveAttribute("href", `/worlds/${worldId}/nations`);
  });

  it("shows admin controls (edit, hide, delete) for world admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [createNationRow({ name: "Highmark" })],
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    expect(await screen.findByRole("button", { name: /Edit/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Hide nation/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Delete nation/ })).toBeDefined();
  });

  it("hides admin controls for non-admin viewers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [createNationRow({ name: "Highmark" })],
        session: { user: { id: "user-2" } },
        settlementRows: [],
        worldRows: [createWorldRow({ visibility: "public" })],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Highmark" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Hide nation/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete nation/ })).toBeNull();
  });

  it("lists settlements with links to the settlement detail page", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [createNationRow({ name: "Highmark" })],
        session: { user: { id: "user-1" } },
        settlementRows: [
          {
            auto_ready_enabled: false,
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            is_ready_current_turn: false,
            last_ready_at: null,
            name: "Stonehold",
            nation_id: nationId,
            nations: { name: "Highmark" },
            ready_set_at: null,
          },
        ],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    const link = await screen.findByRole("link", { name: "Stonehold" });
    expect(link).toHaveAttribute(
      "href",
      `/worlds/${worldId}/nations/${nationId}/settlements/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
    );
  });

  it("redirects out when the nation is hidden and the viewer cannot manage the world", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [createNationRow({ is_hidden: true, name: "Veilreach" })],
        session: { user: { id: "user-2" } },
        settlementRows: [],
        worldRows: [createWorldRow({ visibility: "public" })],
      }),
    );

    renderPage();

    await screen.findByRole("status", { name: "Redirecting…" });
    expect(navigateMock).toHaveBeenCalledWith({
      params: { worldId },
      replace: true,
      to: "/worlds/$worldId/nations",
    });
    expect(screen.queryByRole("heading", { name: "Veilreach" })).toBeNull();
  });

  it("shows the hidden badge to world owners viewing a hidden nation", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [createNationRow({ is_hidden: true, name: "Veilreach" })],
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Veilreach" }),
    ).toBeDefined();
    expect(screen.getByText("Hidden")).toBeDefined();
    expect(screen.getByRole("button", { name: /Show nation/ })).toBeDefined();
  });

  it("shows the hidden badge to delegated world admins viewing a hidden nation", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: worldId }],
        nationRows: [createNationRow({ is_hidden: true, name: "Veilreach" })],
        session: { user: { id: "user-2" } },
        settlementRows: [],
        worldRows: [createWorldRow({ visibility: "public" })],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Veilreach" }),
    ).toBeDefined();
    expect(screen.getByText("Hidden")).toBeDefined();
    expect(screen.getByRole("button", { name: /Show nation/ })).toBeDefined();
  });

  it("shows the hidden badge to super admins viewing a hidden nation", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: true,
        nationRows: [createNationRow({ is_hidden: true, name: "Veilreach" })],
        session: { user: { id: "user-3" } },
        settlementRows: [],
        worldRows: [createWorldRow({ visibility: "private" })],
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Veilreach" }),
    ).toBeDefined();
    expect(screen.getByText("Hidden")).toBeDefined();
  });

  it("renders an access-denied state when the world is not visible", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [createNationRow({ name: "Highmark" })],
        session: { user: { id: "user-1" } },
        settlementRows: [],
        worldRows: [],
      }),
    );

    renderPage();

    expect(await screen.findByText("World unavailable")).toBeDefined();
  });

  it("lists relationships against other nations for admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    // Open relationship for Veilreach by clicking its nation name
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    expect(
      await screen.findByText(
        (_, element) => element?.textContent === "Current stance: Neutral",
      ),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Propose alliance/ }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Propose non-aggression pact/ }),
    ).toBeDefined();
  });

  it("hides relationship controls from non-admin viewers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        session: { user: { id: "user-2" } },
        settlementRows: [],
        worldRows: [createWorldRow({ visibility: "public" })],
      }),
    );

    renderPage();

    // Open relationship for Veilreach by clicking its nation name
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    // Verify controls are hidden (not present even after opening)
    expect(
      screen.queryByRole("button", { name: /Propose alliance/ }),
    ).toBeNull();
    expect(screen.queryByRole("combobox", { name: /Set stance/ })).toBeNull();
  });

  it("shows pending-outgoing proposal copy when a proposal awaits the other nation", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        outgoingRelationships: [
          createRelationshipRow({
            from_nation_id: nationId,
            pending_stance: "allied",
            pending_status: "proposed",
            to_nation_id: otherNationId,
          }),
        ],
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    // Open relationships collapsible
    // Click on Veilreach nation to expand its relationships
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    expect(await screen.findByText(/Sent proposal:/)).toBeDefined();
    expect(screen.getByText(/Allied — awaiting Veilreach\./)).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /Propose alliance/ }),
    ).toBeNull();
  });

  it("shows incoming-proposal copy with accept and decline controls", async () => {
    const respondToBilateral: UpdateMock = vi.fn(() => ({
      data: createRelationshipRow({
        current_stance: "allied",
        from_nation_id: otherNationId,
        pending_stance: "allied",
        pending_status: "accepted",
        to_nation_id: nationId,
      }),
      error: null,
    }));

    requireSupabaseClient.mockReturnValue(
      createClient({
        incomingRelationships: [
          createRelationshipRow({
            from_nation_id: otherNationId,
            pending_stance: "non_aggression_pact",
            pending_status: "proposed",
            to_nation_id: nationId,
          }),
        ],
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        respondToBilateralResult: respondToBilateral,
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    // Open relationships collapsible
    // Click on Veilreach nation to expand its relationships
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    await screen.findByText(/Incoming proposal:/);
    expect(
      screen.getByText(/Veilreach proposes Non-aggression pact/),
    ).toBeDefined();

    const accept = await screen.findByRole("button", {
      name: /Accept proposal/,
    });
    await userEvent.click(accept);

    await waitFor(() => {
      expect(respondToBilateral).toHaveBeenCalledTimes(1);
    });
  });

  it("calls decline when the user declines an incoming proposal", async () => {
    const respondToBilateral: UpdateMock = vi.fn(() => ({
      data: createRelationshipRow({
        from_nation_id: otherNationId,
        pending_stance: null,
        pending_status: "declined",
        to_nation_id: nationId,
      }),
      error: null,
    }));

    requireSupabaseClient.mockReturnValue(
      createClient({
        incomingRelationships: [
          createRelationshipRow({
            from_nation_id: otherNationId,
            pending_stance: "allied",
            pending_status: "proposed",
            to_nation_id: nationId,
          }),
        ],
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        respondToBilateralResult: respondToBilateral,
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    // Open relationships collapsible
    // Click on Veilreach nation to expand its relationships
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    const decline = await screen.findByRole("button", {
      name: /Decline proposal/,
    });
    await userEvent.click(decline);

    await waitFor(() => {
      expect(respondToBilateral).toHaveBeenCalledTimes(1);
    });
  });

  it("invokes the propose-bilateral mutation when proposing an alliance", async () => {
    const upsertMock: UpsertMock = vi.fn(() => ({
      data: createRelationshipRow({
        from_nation_id: nationId,
        pending_stance: "allied",
        pending_status: "proposed",
        to_nation_id: otherNationId,
      }),
      error: null,
    }));

    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        relationshipsUpsertResult: upsertMock,
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    // Open relationships collapsible
    // Click on Veilreach nation to expand its relationships
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    const propose = await screen.findByRole("button", {
      name: /Propose alliance/,
    });
    await userEvent.click(propose);

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1);
    });
    const [payload] = upsertMock.mock.calls[0];
    expect(payload).toMatchObject({
      from_nation_id: nationId,
      pending_stance: "allied",
      pending_status: "proposed",
      to_nation_id: otherNationId,
    });
  });

  it("invokes the unilateral-stance mutation when the stance is changed", async () => {
    const upsertMock: UpsertMock = vi.fn(() => ({
      data: createRelationshipRow({
        current_stance: "hostile",
        from_nation_id: nationId,
        to_nation_id: otherNationId,
      }),
      error: null,
    }));

    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        relationshipsUpsertResult: upsertMock,
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    // Open relationships collapsible
    // Click on Veilreach nation to expand its relationships
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    const select = await screen.findByRole("combobox", {
      name: /Set stance/,
    });
    await userEvent.selectOptions(select, "hostile");

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1);
    });
    const [payload] = upsertMock.mock.calls[0];
    expect(payload).toMatchObject({
      current_stance: "hostile",
      from_nation_id: nationId,
      pending_stance: null,
      pending_status: null,
      to_nation_id: otherNationId,
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Stance toward Veilreach updated.",
        undefined,
      );
    });
  });

  it("renders a withdraw control when the relationship is allied", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        outgoingRelationships: [
          createRelationshipRow({
            current_stance: "allied",
            from_nation_id: nationId,
            to_nation_id: otherNationId,
          }),
        ],
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    // Open relationships collapsible
    // Click on Veilreach nation to expand its relationships
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    expect(
      await screen.findByRole("button", { name: /Withdraw agreement/ }),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /Propose alliance/ }),
    ).toBeNull();
  });

  it("opens a confirmation dialog when changing stance from a bilateral relationship", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        outgoingRelationships: [
          createRelationshipRow({
            current_stance: "allied",
            from_nation_id: nationId,
            to_nation_id: otherNationId,
          }),
        ],
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    // Open relationships collapsible
    // Click on Veilreach nation to expand its relationships
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    const select = await screen.findByRole("combobox", { name: /Set stance/ });
    await userEvent.selectOptions(select, "hostile");

    expect(await screen.findByRole("dialog")).toBeDefined();
    expect(screen.getByText(/will dissolve the existing/)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Withdraw agreement/ }),
    ).toBeDefined();
  });

  it("fires the unilateral mutation after confirming a bilateral override", async () => {
    const upsertMock: UpsertMock = vi.fn(() => ({
      data: createRelationshipRow({
        current_stance: "hostile",
        from_nation_id: nationId,
        to_nation_id: otherNationId,
      }),
      error: null,
    }));

    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        outgoingRelationships: [
          createRelationshipRow({
            current_stance: "allied",
            from_nation_id: nationId,
            to_nation_id: otherNationId,
          }),
        ],
        relationshipsUpsertResult: upsertMock,
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    // Open relationships collapsible
    // Click on Veilreach nation to expand its relationships
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    const select = await screen.findByRole("combobox", { name: /Set stance/ });
    await userEvent.selectOptions(select, "hostile");

    const confirmBtn = await screen.findByRole("button", {
      name: /Set hostile/,
    });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1);
    });
    const [payload] = upsertMock.mock.calls[0];
    expect(payload).toMatchObject({
      current_stance: "hostile",
      from_nation_id: nationId,
      to_nation_id: otherNationId,
    });
  });

  it("emits a success toast and navigates after a nation is deleted", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationDeleteResult: {
          data: { id: nationId, world_id: worldId },
          error: null,
        },
        nationRows: [createNationRow({ id: nationId, name: "Highmark" })],
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: /Delete nation/ }),
    );

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Delete nation/ }),
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        params: { worldId },
        replace: true,
        to: "/worlds/$worldId/nations",
      });
    });
    expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
      "Nation deleted.",
      undefined,
    );
  });

  it("does not fire the mutation when a bilateral override is cancelled", async () => {
    const upsertMock: UpsertMock = vi.fn(() => ({
      data: null,
      error: null,
    }));

    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [
          createNationRow({ id: nationId, name: "Highmark" }),
          createNationRow({ id: otherNationId, name: "Veilreach" }),
        ],
        outgoingRelationships: [
          createRelationshipRow({
            current_stance: "allied",
            from_nation_id: nationId,
            to_nation_id: otherNationId,
          }),
        ],
        relationshipsUpsertResult: upsertMock,
        session: { user: { id: "user-1" } },
        settlementRows: [],
        adminRows: [{ world_id: worldId }],
        worldRows: [createWorldRow()],
      }),
    );

    renderPage();

    // Open relationships collapsible
    // Click on Veilreach nation to expand its relationships
    const veilreachTrigger = await screen.findByRole("button", {
      name: /Veilreach/,
    });
    await userEvent.click(veilreachTrigger);

    const select = await screen.findByRole("combobox", { name: /Set stance/ });
    await userEvent.selectOptions(select, "hostile");

    await screen.findByRole("dialog");

    const cancelBtn = screen.getByRole("button", { name: /Cancel/ });
    await userEvent.click(cancelBtn);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NationDetailPage nationId={nationId} worldId={worldId} />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

type TestNationRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly is_hidden: boolean;
  readonly name: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestSettlementRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly last_ready_at: string | null;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: {
    readonly name: string;
  };
  readonly ready_set_at: string | null;
};

type TestRelationshipRow = {
  readonly created_at: string;
  readonly current_stance: string;
  readonly from_nation_id: string;
  readonly id: string;
  readonly pending_changed_by_citizen_id: string | null;
  readonly pending_stance: string | null;
  readonly pending_status: string | null;
  readonly to_nation_id: string;
  readonly updated_at: string;
};

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly calendar_config_json: WorldCalendarConfig | null;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
};

type TestUser = {
  readonly created_at: string;
  readonly email: string;
  readonly id: string;
  readonly is_super_admin: boolean;
  readonly status: string;
  readonly updated_at: string;
  readonly username: string;
};

type RelationshipMutationResult = {
  readonly data: TestRelationshipRow | null;
  readonly error: unknown;
};

type UpsertMock = Mock<
  (
    values: Record<string, unknown>,
    options: unknown,
  ) => RelationshipMutationResult
>;

type UpdateMock = Mock<
  (values: Record<string, unknown>) => RelationshipMutationResult
>;

type NationDeleteResult = {
  readonly data: {
    readonly id: string;
    readonly world_id: string;
  } | null;
  readonly error: { readonly message: string } | null;
};

function createClient({
  adminRows = [],
  incomingRelationships = [],
  isSuperAdmin = false,
  nationDeleteResult,
  nationRows,
  outgoingRelationships = [],
  relationshipsPendingStatusResult,
  relationshipsUpsertResult,
  respondToBilateralResult,
  session,
  settlementRows,
  worldRows,
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly incomingRelationships?: readonly TestRelationshipRow[];
  readonly isSuperAdmin?: boolean;
  readonly nationDeleteResult?: NationDeleteResult;
  readonly nationRows: readonly TestNationRow[];
  readonly outgoingRelationships?: readonly TestRelationshipRow[];
  readonly relationshipsPendingStatusResult?: {
    readonly data: { readonly pending_status: string | null } | null;
    readonly error: null;
  };
  readonly relationshipsUpsertResult?: UpsertMock;
  readonly respondToBilateralResult?: UpdateMock;
  readonly session: { readonly user: { readonly id: string } };
  readonly settlementRows: readonly TestSettlementRow[];
  readonly worldRows: readonly TestWorldRow[];
}): unknown {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return createUsersQueryBuilder(
          createUser(session.user.id, isSuperAdmin),
        );
      }
      if (table === "world_admins") {
        return createWorldAdminsQueryBuilder(adminRows);
      }
      if (table === "worlds") {
        return createWorldsQueryBuilder(worldRows);
      }
      if (table === "nations") {
        return createNationsQueryBuilder(nationRows, nationDeleteResult);
      }
      if (table === "nation_relationships") {
        return createNationRelationshipsQueryBuilder({
          incoming: incomingRelationships,
          outgoing: outgoingRelationships,
          pendingStatusResult: relationshipsPendingStatusResult,
          upsertResult: relationshipsUpsertResult,
        });
      }
      if (table === "settlements") {
        return createSettlementsQueryBuilder(settlementRows);
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((fn: string, params: Record<string, unknown>) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      if (fn === "respond_to_bilateral") {
        return {
          maybeSingle: vi.fn().mockImplementation(() => {
            if (respondToBilateralResult !== undefined) {
              return Promise.resolve(respondToBilateralResult(params));
            }
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    }),
  };
}

function createUser(id: string, isSuperAdmin: boolean): TestUser {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    email: `${id}@example.com`,
    id,
    is_super_admin: isSuperAdmin,
    status: "active",
    updated_at: "2026-01-01T00:00:00.000Z",
    username: id,
  };
}

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    calendar_config_json: createCalendarConfig(),
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 1,
    id: worldId,
    name: "World",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "private",
    ...overrides,
  };
}

function createCalendarConfig(): WorldCalendarConfig {
  return {
    months: [
      { dayCount: 2, index: 0, name: "Dawn" },
      { dayCount: 3, index: 1, name: "Ember" },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 100,
    weekdays: [
      { index: 0, name: "Firstday" },
      { index: 1, name: "Secondday" },
    ],
    dateFormatTemplate: "{weekday}, {month} {day}, {year} AG",
  };
}

function createNationRow(
  overrides: Partial<TestNationRow> = {},
): TestNationRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    id: nationId,
    is_hidden: false,
    name: "Nation",
    updated_at: "2026-01-02T00:00:00.000Z",
    world_id: worldId,
    ...overrides,
  };
}

function createRelationshipRow(
  overrides: Partial<TestRelationshipRow> = {},
): TestRelationshipRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    current_stance: "neutral",
    from_nation_id: nationId,
    id: "99999999-9999-9999-9999-999999999999",
    pending_changed_by_citizen_id: null,
    pending_stance: null,
    pending_status: null,
    to_nation_id: otherNationId,
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function createUsersQueryBuilder(user: TestUser): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: user, error: null }),
      })),
    })),
  };
}

function createWorldAdminsQueryBuilder(
  rows: readonly { readonly world_id: string }[],
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      })),
    })),
  };
}

function createWorldsQueryBuilder(rows: readonly TestWorldRow[]): unknown {
  return {
    select: vi.fn(() => ({
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      eq: vi.fn((column: string, value: string) => {
        const data =
          column === "id"
            ? (rows.find((row) => row.id === value) ?? null)
            : null;
        return {
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        };
      }),
    })),
  };
}

function createNationsQueryBuilder(
  rows: readonly TestNationRow[],
  deleteResult?: NationDeleteResult,
): unknown {
  const listBuilder = {
    eq: vi.fn(() => listBuilder),
    order: vi.fn(() => listBuilder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return {
    delete: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      chain.eq = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.maybeSingle = vi
        .fn()
        .mockResolvedValue(deleteResult ?? { data: null, error: null });
      return chain;
    }),
    select: vi.fn(() => ({
      ...listBuilder,
      eq: vi.fn((column: string, value: string) => {
        if (column === "id") {
          const row = rows.find((candidate) => candidate.id === value) ?? null;
          return {
            maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
          };
        }
        return listBuilder;
      }),
    })),
  };
}

function createNationRelationshipsQueryBuilder({
  incoming,
  outgoing,
  pendingStatusResult = { data: null, error: null },
  upsertResult,
}: {
  readonly incoming: readonly TestRelationshipRow[];
  readonly outgoing: readonly TestRelationshipRow[];
  readonly pendingStatusResult?: {
    readonly data: { readonly pending_status: string | null } | null;
    readonly error: null;
  };
  readonly upsertResult?: UpsertMock;
}): unknown {
  return {
    select: vi.fn(() => {
      let columnFilter: string | null = null;
      const builder = {
        eq: vi.fn((column: string) => {
          columnFilter = column;
          return builder;
        }),
        maybeSingle: vi.fn().mockResolvedValue(pendingStatusResult),
        order: vi.fn(() => builder),
        returns: vi.fn().mockImplementation(() => {
          if (columnFilter === "from_nation_id") {
            return Promise.resolve({ data: outgoing, error: null });
          }
          return Promise.resolve({ data: incoming, error: null });
        }),
      };
      return builder;
    }),
    upsert: vi.fn((values: Record<string, unknown>, options: unknown) => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockImplementation(() => {
          if (upsertResult !== undefined) {
            return Promise.resolve(upsertResult(values, options));
          }
          return Promise.resolve({ data: null, error: null });
        }),
      })),
    })),
    update: vi.fn(() => {
      const chain = {
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn(() => chain),
      };
      return chain;
    }),
  };
}

function createSettlementsQueryBuilder(
  rows: readonly TestSettlementRow[],
): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
    select: vi.fn(() => builder),
  };
  return builder;
}
