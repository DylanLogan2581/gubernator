import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearLastWorldPin,
  readLastWorldPin,
  writeLastWorldPin,
} from "./lastWorldPin";

describe("lastWorldPin", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to null when nothing is stored", () => {
    expect(readLastWorldPin()).toBeNull();
  });

  it("round-trips a world id through localStorage", () => {
    writeLastWorldPin("world-1");
    expect(readLastWorldPin()).toBe("world-1");
  });

  it("overwrites the previous pin on a new write", () => {
    writeLastWorldPin("world-1");
    writeLastWorldPin("world-2");
    expect(readLastWorldPin()).toBe("world-2");
  });

  it("clears the pin", () => {
    writeLastWorldPin("world-1");
    clearLastWorldPin();
    expect(readLastWorldPin()).toBeNull();
  });

  it("swallows storage errors and returns null", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    expect(readLastWorldPin()).toBeNull();

    getItem.mockRestore();
  });
});
