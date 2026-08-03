import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { CitizenCoreSection } from "./CoreEditForm";
import { useCitizenCoreEditState } from "./hooks/UseCitizenCoreEditState";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { useBlockerMock } = vi.hoisted(() => ({
  useBlockerMock: vi.fn<
    (opts: { readonly shouldBlockFn: () => boolean }) => {
      readonly status: "blocked" | "idle";
    }
  >(),
}));

vi.mock("@tanstack/react-router", () => ({
  useBlocker: useBlockerMock,
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000010";

describe("CitizenCoreSection unsaved changes guard", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    requireSupabaseClient.mockReturnValue({});
    useBlockerMock.mockReset();
    useBlockerMock.mockReturnValue({ status: "idle" });
  });

  it("does not block navigation before entering edit mode", () => {
    renderSection();

    expect(useBlockerMock.mock.calls[0][0].shouldBlockFn()).toBe(false);
  });

  it("blocks navigation once a field is edited in the editor", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(latestShouldBlock()).toBe(false);

    await user.type(givenNameInput(), "d");

    expect(latestShouldBlock()).toBe(true);
  });

  it("stops blocking navigation after cancelling the edit", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(givenNameInput(), "d");
    expect(latestShouldBlock()).toBe(true);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(latestShouldBlock()).toBe(false);
  });

  it("preserves the typed draft when the section stays mounted", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(givenNameInput(), "d");

    expect(givenNameInput()).toHaveValue("Citizend");
  });
});

function givenNameInput(): HTMLElement {
  return screen.getAllByRole("textbox")[0];
}

function latestShouldBlock(): boolean {
  const lastCall =
    useBlockerMock.mock.calls[useBlockerMock.mock.calls.length - 1];
  return lastCall[0].shouldBlockFn();
}

function CoreEditFormHost({
  citizen,
  queryClient,
}: {
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const editState = useCitizenCoreEditState(citizen);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CitizenCoreSection
          canEdit={true}
          citizen={citizen}
          editState={editState}
          queryClient={queryClient}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function renderSection(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <CoreEditFormHost citizen={createCitizen()} queryClient={queryClient} />,
  );
}

function createCitizen(overrides: Partial<Citizen> = {}): Citizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "npc",
    createdAt: "2026-05-01T00:00:00.000Z",
    cultureId: null,
    deathCause: null,
    deathCauseCategory: null,
    educationLevelId: null,
    givenName: "Citizen",
    id: "citizen-1",
    name: "Citizen",
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
    userId: null,
    worldId: WORLD_ID,
    ...overrides,
  };
}
