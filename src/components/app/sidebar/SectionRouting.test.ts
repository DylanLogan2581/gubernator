import { describe, expect, it } from "vitest";

import { sectionFromPathname } from "./SectionRouting";

const SEGMENTS = new Set(["citizens", "government", "settlements"]);
const BASE = "/worlds/w1/nations/n1";

describe("sectionFromPathname", () => {
  it("returns the matched segment for a recognized suffix", () => {
    expect(
      sectionFromPathname(`${BASE}/government`, BASE, {
        fallback: "overview",
        segments: SEGMENTS,
      }),
    ).toBe("government");
  });

  it("falls back for the base path with no suffix", () => {
    expect(
      sectionFromPathname(BASE, BASE, {
        fallback: "overview",
        segments: SEGMENTS,
      }),
    ).toBe("overview");
  });

  it("falls back for an unrecognized suffix", () => {
    expect(
      sectionFromPathname(`${BASE}/mystery`, BASE, {
        fallback: "overview",
        segments: SEGMENTS,
      }),
    ).toBe("overview");
  });

  it("returns null under a nullSubtreePrefix instead of falling back", () => {
    expect(
      sectionFromPathname(`${BASE}/settlements/s1/citizens`, BASE, {
        fallback: "overview",
        nullSubtreePrefix: "settlements/",
        segments: SEGMENTS,
      }),
    ).toBeNull();
  });

  it("still matches the bare prefix segment when a nullSubtreePrefix is set", () => {
    // `settlements` (the nation section) must stay active — only the deeper
    // `settlements/<id>` detail subtree returns null.
    expect(
      sectionFromPathname(`${BASE}/settlements`, BASE, {
        fallback: "overview",
        nullSubtreePrefix: "settlements/",
        segments: SEGMENTS,
      }),
    ).toBe("settlements");
  });
});
