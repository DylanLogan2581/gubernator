import { describe, expect, it } from "vitest";

import { isManagerRole, isPlayerRole, managerScopeLabel } from "./citizenRoles";

describe("isManagerRole", () => {
  it("returns true for nation_manager", () => {
    expect(isManagerRole("nation_manager")).toBe(true);
  });

  it("returns true for settlement_manager", () => {
    expect(isManagerRole("settlement_manager")).toBe(true);
  });

  it("returns false for none", () => {
    expect(isManagerRole("none")).toBe(false);
  });
});

describe("isPlayerRole", () => {
  it("returns true for none", () => {
    expect(isPlayerRole("none")).toBe(true);
  });

  it("returns false for nation_manager", () => {
    expect(isPlayerRole("nation_manager")).toBe(false);
  });

  it("returns false for settlement_manager", () => {
    expect(isPlayerRole("settlement_manager")).toBe(false);
  });
});

describe("managerScopeLabel", () => {
  it("returns 'nation' for nation_manager", () => {
    expect(managerScopeLabel("nation_manager")).toBe("nation");
  });

  it("returns 'settlement' for settlement_manager", () => {
    expect(managerScopeLabel("settlement_manager")).toBe("settlement");
  });

  it("returns null for none", () => {
    expect(managerScopeLabel("none")).toBeNull();
  });
});
