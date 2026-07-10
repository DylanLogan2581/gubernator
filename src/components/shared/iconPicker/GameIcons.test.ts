import { describe, expect, it } from "vitest";

import {
  bareGameIconName,
  categorizeGameIconName,
  createGameIconComponent,
  GAME_ICON_PREFIX,
  isGameIconName,
  loadGameIconsData,
  toGameIconName,
} from "./GameIcons";

describe("game icon name helpers", () => {
  it("recognizes a game-icons namespaced name", () => {
    expect(isGameIconName("game:anvil")).toBe(true);
    expect(isGameIconName("anvil")).toBe(false);
  });

  it("round-trips bare and namespaced names", () => {
    expect(toGameIconName("anvil")).toBe(`${GAME_ICON_PREFIX}anvil`);
    expect(bareGameIconName(toGameIconName("anvil"))).toBe("anvil");
  });
});

describe("categorizeGameIconName", () => {
  it("matches a keyword to its category", () => {
    expect(categorizeGameIconName("wheat-sheaf")).toBe("Resources");
    expect(categorizeGameIconName("blacksmith-anvil")).toBe("Tools");
  });

  it("falls back to Other when no keyword matches", () => {
    expect(categorizeGameIconName("totally-unrelated-glyph")).toBe("Other");
  });
});

describe("createGameIconComponent", () => {
  it("caches the component per bare icon name", () => {
    expect(createGameIconComponent("anvil")).toBe(
      createGameIconComponent("anvil"),
    );
  });

  it("returns distinct components for distinct names", () => {
    expect(createGameIconComponent("anvil")).not.toBe(
      createGameIconComponent("sword"),
    );
  });
});

describe("loadGameIconsData", () => {
  it("resolves the bundled offline collection", async () => {
    const data = await loadGameIconsData();
    expect(Object.keys(data.icons).length).toBeGreaterThan(1000);
  });
});
