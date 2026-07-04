import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import type { Citizen } from "@/features/citizens";
import {
  ActivePlayerCharacterContext,
  type ActivePlayerCharacterContextValue,
} from "@/features/permissions";

import { useEffectiveCanAdmin } from "./useEffectiveCanAdmin";

import type { JSX, ReactNode } from "react";

function makeContextValue(
  activeCharacter: Citizen | null,
): ActivePlayerCharacterContextValue {
  return {
    activeCharacter,
    clear: () => undefined,
    isPending: false,
    selectableCharacters: [],
    switchTo: () => undefined,
  };
}

function makeCharacter(): Citizen {
  return {
    bornOnTurnNumber: null,
    citizenType: "player_character",
    createdAt: "2026-01-01T00:00:00Z",
    deathCause: null,
    deathCauseCategory: null,
    givenName: "Alice",
    id: "citizen-1",
    name: "Alice Smith",
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    profilePhotoUrl: null,
    roleNationId: "nation-1",
    roleSettlementId: null,
    roleType: "nation_manager",
    settlementId: "settlement-1",
    sex: null,
    status: "alive",
    surname: "Smith",
    updatedAt: "2026-01-01T00:00:00Z",
    userId: "user-1",
    worldId: "world-1",
  };
}

// Module-level wrapper components for renderHook — must not be defined inside
// functions to satisfy the @eslint-react/component-hook-factories rule.
function WrapperNoCharacter({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return createElement(
    ActivePlayerCharacterContext,
    { value: makeContextValue(null) },
    children,
  );
}

function WrapperWithCharacter({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return createElement(
    ActivePlayerCharacterContext,
    { value: makeContextValue(makeCharacter()) },
    children,
  );
}

describe("useEffectiveCanAdmin", () => {
  it("returns true when canAdmin is true and no active character", () => {
    const { result } = renderHook(() => useEffectiveCanAdmin(true), {
      wrapper: WrapperNoCharacter,
    });
    expect(result.current).toBe(true);
  });

  it("returns false when canAdmin is true but an active player character is selected", () => {
    const { result } = renderHook(() => useEffectiveCanAdmin(true), {
      wrapper: WrapperWithCharacter,
    });
    expect(result.current).toBe(false);
  });

  it("returns false when canAdmin is false and no active character", () => {
    const { result } = renderHook(() => useEffectiveCanAdmin(false), {
      wrapper: WrapperNoCharacter,
    });
    expect(result.current).toBe(false);
  });

  it("returns false when canAdmin is false and an active character is selected", () => {
    const { result } = renderHook(() => useEffectiveCanAdmin(false), {
      wrapper: WrapperWithCharacter,
    });
    expect(result.current).toBe(false);
  });

  it("returns true when no context is provided (empty context default has no active character)", () => {
    // Without a context provider, useActivePlayerCharacter returns EMPTY_VALUE
    // which has activeCharacter: null, so effectiveCanAdmin == canAdmin.
    const { result } = renderHook(() => useEffectiveCanAdmin(true));
    expect(result.current).toBe(true);
  });
});
