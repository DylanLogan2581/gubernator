import { describe, expect, it } from "vitest";

import type { WorldNamingConfig } from "@/lib/worldNamingConfigSchemas";

import { resolveNamingConfig } from "./resolveNamingConfig";

import type { Nameset } from "../types/namesetTypes";

const FALLBACK: WorldNamingConfig = {
  convention: "random",
  female_given_names: ["fallback-f"],
  male_given_names: ["fallback-m"],
  surnames: ["fallback-s"],
};

function makeNameset(overrides: Partial<Nameset> & { id: string }): Nameset {
  return {
    worldId: "world-1",
    name: "Test Nameset",
    configJson: {
      convention: "random",
      female_given_names: [],
      male_given_names: [],
      surnames: [],
    },
    isDefault: false,
    isTrashed: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const WORLD_DEFAULT = makeNameset({
  id: "ns-world",
  isDefault: true,
  configJson: {
    convention: "random",
    female_given_names: ["world-f"],
    male_given_names: ["world-m"],
    surnames: ["world-s"],
  },
});

const NATION_NAMESET = makeNameset({
  id: "ns-nation",
  configJson: {
    convention: "patronymic",
    female_given_names: ["nation-f"],
    male_given_names: ["nation-m"],
    surnames: [],
  },
});

const SETTLEMENT_NAMESET = makeNameset({
  id: "ns-settlement",
  configJson: {
    convention: "inherited family name",
    female_given_names: ["settlement-f"],
    male_given_names: ["settlement-m"],
    surnames: ["settlement-s"],
  },
});

const ALL_NAMESETS = [WORLD_DEFAULT, NATION_NAMESET, SETTLEMENT_NAMESET];

describe("resolveNamingConfig", () => {
  it("returns the settlement-level nameset when settlement has one", () => {
    const result = resolveNamingConfig(
      ALL_NAMESETS,
      FALLBACK,
      SETTLEMENT_NAMESET.id,
      NATION_NAMESET.id,
    );
    expect(result).toEqual(SETTLEMENT_NAMESET.configJson);
  });

  it("falls back to nation nameset when settlement has none", () => {
    const result = resolveNamingConfig(
      ALL_NAMESETS,
      FALLBACK,
      null,
      NATION_NAMESET.id,
    );
    expect(result).toEqual(NATION_NAMESET.configJson);
  });

  it("falls back to world default when neither settlement nor nation has one", () => {
    const result = resolveNamingConfig(ALL_NAMESETS, FALLBACK, null, null);
    expect(result).toEqual(WORLD_DEFAULT.configJson);
  });

  it("falls back to worldFallback when no active default exists", () => {
    const result = resolveNamingConfig([], FALLBACK, null, null);
    expect(result).toEqual(FALLBACK);
  });

  it("skips trashed namesets in resolution chain", () => {
    const trashedSettlement = makeNameset({
      id: "ns-settlement",
      isTrashed: true,
      configJson: SETTLEMENT_NAMESET.configJson,
    });
    const trashedNation = makeNameset({
      id: "ns-nation",
      isTrashed: true,
      configJson: NATION_NAMESET.configJson,
    });
    const result = resolveNamingConfig(
      [WORLD_DEFAULT, trashedNation, trashedSettlement],
      FALLBACK,
      "ns-settlement",
      "ns-nation",
    );
    expect(result).toEqual(WORLD_DEFAULT.configJson);
  });

  it("skips trashed world default and returns worldFallback", () => {
    const trashedDefault = makeNameset({
      id: "ns-world",
      isDefault: true,
      isTrashed: true,
      configJson: WORLD_DEFAULT.configJson,
    });
    const result = resolveNamingConfig([trashedDefault], FALLBACK, null, null);
    expect(result).toEqual(FALLBACK);
  });

  it("clearing a settlement override falls back to nation", () => {
    const result = resolveNamingConfig(
      ALL_NAMESETS,
      FALLBACK,
      null,
      NATION_NAMESET.id,
    );
    expect(result).toEqual(NATION_NAMESET.configJson);
  });

  it("uses nation-level nameset even when settlement has none", () => {
    const result = resolveNamingConfig(
      ALL_NAMESETS,
      FALLBACK,
      undefined,
      NATION_NAMESET.id,
    );
    expect(result).toEqual(NATION_NAMESET.configJson);
  });

  it("handles FK set-null cascade: deleted nameset falls back cleanly", () => {
    // Simulate a deleted nameset: the nameset_id is still set on the entity
    // but the nameset no longer exists in the list (or was hard-deleted).
    const namesetIdOfDeletedNameset = "ns-deleted";
    const result = resolveNamingConfig(
      [WORLD_DEFAULT],
      FALLBACK,
      namesetIdOfDeletedNameset,
      null,
    );
    expect(result).toEqual(WORLD_DEFAULT.configJson);
  });
});
