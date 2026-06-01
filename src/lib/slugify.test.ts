import { describe, expect, it } from "vitest";

import { toSlug } from "./slugify";

describe("toSlug", () => {
  it("lowercases the input", () => {
    expect(toSlug("Iron Ore")).toBe("iron-ore");
  });

  it("replaces spaces and special characters with hyphens", () => {
    expect(toSlug("foo  bar--baz")).toBe("foo-bar-baz");
  });

  it("strips leading and trailing hyphens", () => {
    expect(toSlug("  hello world  ")).toBe("hello-world");
  });

  it("handles an already-slugified string", () => {
    expect(toSlug("my-slug")).toBe("my-slug");
  });

  it("returns an empty string for blank input", () => {
    expect(toSlug("")).toBe("");
    expect(toSlug("   ")).toBe("");
  });

  it("trims to maxLength when provided", () => {
    expect(toSlug("iron-ore-deposit", { maxLength: 8 })).toBe("iron-ore");
  });

  it("does not truncate when maxLength is not provided", () => {
    const long = "a".repeat(200);
    expect(toSlug(long)).toHaveLength(200);
  });

  it("does not truncate when result is shorter than maxLength", () => {
    expect(toSlug("iron", { maxLength: 64 })).toBe("iron");
  });
});
