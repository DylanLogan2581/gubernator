import { describe, expect, it } from "vitest";

import {
  CURATED_ICONS,
  CURATED_ICON_NAMES,
  FALLBACK_ICON,
  formatIconLabel,
  resolveEntityIcon,
} from "./CuratedIcons";

describe("resolveEntityIcon", () => {
  it("resolves a known curated icon name to its component", () => {
    expect(resolveEntityIcon("wheat")).toBe(CURATED_ICONS.wheat);
  });

  it("falls back for null", () => {
    expect(resolveEntityIcon(null)).toBe(FALLBACK_ICON);
  });

  it("falls back for undefined", () => {
    expect(resolveEntityIcon(undefined)).toBe(FALLBACK_ICON);
  });

  it("falls back for an unknown/stale icon name without crashing", () => {
    expect(resolveEntityIcon("not-a-real-icon")).toBe(FALLBACK_ICON);
  });

  it("falls back for an empty string", () => {
    expect(resolveEntityIcon("")).toBe(FALLBACK_ICON);
  });
});

describe("formatIconLabel", () => {
  it("title-cases a single-word name", () => {
    expect(formatIconLabel("wheat")).toBe("Wheat");
  });

  it("title-cases each hyphen-separated part", () => {
    expect(formatIconLabel("cup-soda")).toBe("Cup Soda");
    expect(formatIconLabel("flag-triangle-right")).toBe("Flag Triangle Right");
  });
});

describe("CURATED_ICON_NAMES", () => {
  it("has no duplicate names", () => {
    expect(new Set(CURATED_ICON_NAMES).size).toBe(CURATED_ICON_NAMES.length);
  });

  it("is sorted alphabetically", () => {
    expect([...CURATED_ICON_NAMES].sort((a, b) => a.localeCompare(b))).toEqual(
      CURATED_ICON_NAMES,
    );
  });

  it("every name resolves to a component other than the fallback", () => {
    for (const name of CURATED_ICON_NAMES) {
      expect(resolveEntityIcon(name)).not.toBe(FALLBACK_ICON);
    }
  });
});
