import { beforeEach, describe, expect, it } from "vitest";

import {
  matchEntityPath,
  readRecentPages,
  recordRecentPage,
} from "./recentPages";

describe("matchEntityPath", () => {
  it("matches a world dashboard", () => {
    expect(matchEntityPath("/worlds/world-1")).toEqual({
      kind: "world",
      path: "/worlds/world-1",
      worldId: "world-1",
    });
  });

  it("matches a nation overview", () => {
    expect(matchEntityPath("/worlds/world-1/nations/nation-1")).toEqual({
      kind: "nation",
      nationId: "nation-1",
      path: "/worlds/world-1/nations/nation-1",
      worldId: "world-1",
    });
  });

  it("matches a settlement overview", () => {
    expect(
      matchEntityPath(
        "/worlds/world-1/nations/nation-1/settlements/settlement-1",
      ),
    ).toEqual({
      kind: "settlement",
      nationId: "nation-1",
      path: "/worlds/world-1/nations/nation-1/settlements/settlement-1",
      settlementId: "settlement-1",
      worldId: "world-1",
    });
  });

  it("matches a citizen detail page", () => {
    expect(matchEntityPath("/worlds/world-1/citizens/citizen-1")).toEqual({
      citizenId: "citizen-1",
      kind: "citizen",
      path: "/worlds/world-1/citizens/citizen-1",
      worldId: "world-1",
    });
  });

  it("does not match a deeper nation sub-page", () => {
    expect(
      matchEntityPath("/worlds/world-1/nations/nation-1/government"),
    ).toBeNull();
  });

  it("does not match unrelated routes", () => {
    expect(matchEntityPath("/notifications")).toBeNull();
    expect(matchEntityPath("/superadmin")).toBeNull();
    expect(matchEntityPath("/worlds/world-1/configuration")).toBeNull();
  });
});

describe("recentPages ring", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to an empty ring when nothing is stored", () => {
    expect(readRecentPages()).toEqual([]);
  });

  it("round-trips an entry through localStorage", () => {
    recordRecentPage({
      kind: "world",
      label: "Eastern Marches",
      path: "/worlds/world-1",
      worldId: "world-1",
    });

    expect(readRecentPages()).toEqual([
      {
        kind: "world",
        label: "Eastern Marches",
        path: "/worlds/world-1",
        worldId: "world-1",
      },
    ]);
  });

  it("puts the most recently recorded entry first", () => {
    recordRecentPage({
      kind: "world",
      label: "First",
      path: "/worlds/world-1",
      worldId: "world-1",
    });
    recordRecentPage({
      kind: "world",
      label: "Second",
      path: "/worlds/world-2",
      worldId: "world-2",
    });

    expect(readRecentPages().map((entry) => entry.label)).toEqual([
      "Second",
      "First",
    ]);
  });

  it("dedupes by path, bumping the re-visited entry to the front", () => {
    recordRecentPage({
      kind: "world",
      label: "First",
      path: "/worlds/world-1",
      worldId: "world-1",
    });
    recordRecentPage({
      kind: "world",
      label: "Second",
      path: "/worlds/world-2",
      worldId: "world-2",
    });
    recordRecentPage({
      kind: "world",
      label: "First (revisited)",
      path: "/worlds/world-1",
      worldId: "world-1",
    });

    expect(readRecentPages()).toHaveLength(2);
    expect(readRecentPages().map((entry) => entry.label)).toEqual([
      "First (revisited)",
      "Second",
    ]);
  });

  it("caps the ring at 8 entries", () => {
    for (let index = 0; index < 10; index += 1) {
      recordRecentPage({
        kind: "world",
        label: `World ${index}`,
        path: `/worlds/world-${index}`,
        worldId: `world-${index}`,
      });
    }

    const entries = readRecentPages();
    expect(entries).toHaveLength(8);
    expect(entries[0]).toEqual({
      kind: "world",
      label: "World 9",
      path: "/worlds/world-9",
      worldId: "world-9",
    });
  });

  it("degrades to an empty ring on corrupt storage", () => {
    window.localStorage.setItem("gubernator:recent-pages", "not json");
    expect(readRecentPages()).toEqual([]);
  });

  it("drops malformed entries instead of throwing", () => {
    window.localStorage.setItem(
      "gubernator:recent-pages",
      JSON.stringify([
        {
          kind: "world",
          label: "Valid",
          path: "/worlds/world-1",
          worldId: "world-1",
        },
        { kind: "world", label: "Missing worldId", path: "/worlds/world-2" },
        {
          kind: "nation",
          label: "Missing nationId",
          path: "/worlds/world-1/nations/nation-1",
          worldId: "world-1",
        },
        "not an object",
      ]),
    );

    expect(readRecentPages()).toEqual([
      {
        kind: "world",
        label: "Valid",
        path: "/worlds/world-1",
        worldId: "world-1",
      },
    ]);
  });
});
