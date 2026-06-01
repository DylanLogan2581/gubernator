import { describe, expect, it } from "vitest";

import { sortByName } from "./sortUtils";

describe("sortByName", () => {
  it("sorts items alphabetically by name", () => {
    const items = [
      { id: "1", name: "Zinc" },
      { id: "2", name: "Apple" },
      { id: "3", name: "Mango" },
    ];
    const result = sortByName(items);
    expect(result.map((i) => i.name)).toEqual(["Apple", "Mango", "Zinc"]);
  });

  it("is case-insensitive", () => {
    const items = [
      { id: "1", name: "zinc" },
      { id: "2", name: "Apple" },
      { id: "3", name: "MANGO" },
    ];
    const result = sortByName(items);
    expect(result.map((i) => i.name)).toEqual(["Apple", "MANGO", "zinc"]);
  });

  it("does not mutate the original array", () => {
    const items = [
      { id: "1", name: "Zinc" },
      { id: "2", name: "Apple" },
    ];
    sortByName(items);
    expect(items[0].name).toBe("Zinc");
  });

  it("returns an empty array for empty input", () => {
    expect(sortByName([])).toEqual([]);
  });

  it("returns a single-element array unchanged", () => {
    const items = [{ id: "1", name: "Solo" }];
    expect(sortByName(items)).toEqual(items);
  });
});
