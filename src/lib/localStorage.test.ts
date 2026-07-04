import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from "./localStorage";

describe("localStorage helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(readLocalStorageItem("missing-key")).toBeNull();
  });

  it("round-trips a value through write/read", () => {
    writeLocalStorageItem("key", "value");
    expect(readLocalStorageItem("key")).toBe("value");
  });

  it("removes a stored value", () => {
    writeLocalStorageItem("key", "value");
    removeLocalStorageItem("key");
    expect(readLocalStorageItem("key")).toBeNull();
  });

  it("swallows read errors and returns null", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    expect(readLocalStorageItem("key")).toBeNull();

    getItem.mockRestore();
  });

  it("swallows write errors", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    expect(() => writeLocalStorageItem("key", "value")).not.toThrow();

    setItem.mockRestore();
  });

  it("swallows remove errors", () => {
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    expect(() => removeLocalStorageItem("key")).not.toThrow();

    removeItem.mockRestore();
  });
});
