import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Citizen } from "@/features/citizens";

import { ActivePlayerCharacterContext } from "../context/activePlayerCharacterContext";

import { AdminPausedHint } from "./AdminPausedHint";

import type { ActivePlayerCharacterContextValue } from "../context/activePlayerCharacterContext";

describe("AdminPausedHint", () => {
  it("renders nothing when the viewer lacks admin rights", () => {
    const { container } = renderHint({
      activeCharacter: createCitizen(),
      canAdmin: false,
    });

    expect(container.textContent).toBe("");
  });

  it("renders nothing when admin rights are present but no character is active", () => {
    const { container } = renderHint({
      activeCharacter: null,
      canAdmin: true,
    });

    expect(container.textContent).toBe("");
  });

  it("names the active character and offers a way back to Admin mode", async () => {
    const clear = vi.fn();
    renderHint({
      activeCharacter: createCitizen({ name: "Kestrel Crane" }),
      canAdmin: true,
      clear,
    });

    expect(screen.getByText("Admin controls are paused")).toBeDefined();
    expect(screen.getByText(/Kestrel Crane/)).toBeDefined();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch to Admin" }));
    expect(clear).toHaveBeenCalled();
  });
});

function renderHint({
  activeCharacter,
  canAdmin,
  clear = (): void => {},
}: {
  readonly activeCharacter: Citizen | null;
  readonly canAdmin: boolean;
  readonly clear?: () => void;
}): ReturnType<typeof render> {
  const value: ActivePlayerCharacterContextValue = {
    activeCharacter,
    clear,
    isExplicitAdminChoice: false,
    isPending: false,
    selectableCharacters: [],
    switchTo: () => undefined,
  };

  return render(
    <ActivePlayerCharacterContext value={value}>
      <AdminPausedHint canAdmin={canAdmin} />
    </ActivePlayerCharacterContext>,
  );
}

function createCitizen(overrides: Partial<Citizen> = {}): Citizen {
  return {
    bornOnTurnNumber: null,
    citizenType: "player_character",
    createdAt: "2026-05-01T00:00:00.000Z",
    cultureId: null,
    deathCause: null,
    deathCauseCategory: null,
    educationLevelId: null,
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
