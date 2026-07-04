import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  readExplicitAdminChoice,
  writeExplicitAdminChoice,
} from "./explicitAdminChoice";

const USER_ID = "user-1";
const WORLD_ID = "world-1";

describe("explicitAdminChoice", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to false when nothing is stored", () => {
    expect(readExplicitAdminChoice(USER_ID, WORLD_ID)).toBe(false);
  });

  it("round-trips true through localStorage", () => {
    writeExplicitAdminChoice(USER_ID, WORLD_ID, true);
    expect(readExplicitAdminChoice(USER_ID, WORLD_ID)).toBe(true);
  });

  it("clears the stored flag when written false", () => {
    writeExplicitAdminChoice(USER_ID, WORLD_ID, true);
    writeExplicitAdminChoice(USER_ID, WORLD_ID, false);
    expect(readExplicitAdminChoice(USER_ID, WORLD_ID)).toBe(false);
  });

  it("scopes the flag per user and world", () => {
    writeExplicitAdminChoice(USER_ID, WORLD_ID, true);
    expect(readExplicitAdminChoice("other-user", WORLD_ID)).toBe(false);
    expect(readExplicitAdminChoice(USER_ID, "other-world")).toBe(false);
  });

  it("swallows storage errors and returns false", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    expect(readExplicitAdminChoice(USER_ID, WORLD_ID)).toBe(false);

    getItem.mockRestore();
  });
});
