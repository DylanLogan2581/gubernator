import { afterEach, describe, expect, it, vi } from "vitest";

import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "./env.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubDenoEnv(values: Record<string, string>): void {
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string): string | undefined => values[name],
    },
  });
}

describe("getRequiredRuntimeEnv", () => {
  it("returns the value verbatim when no trailing slash", () => {
    stubDenoEnv({ MY_VAR: "hello" });
    expect(getRequiredRuntimeEnv("MY_VAR")).toBe("hello");
  });

  it("preserves a trailing slash", () => {
    stubDenoEnv({ MY_VAR: "https://example.com/" });
    expect(getRequiredRuntimeEnv("MY_VAR")).toBe("https://example.com/");
  });

  it("returns undefined when the variable is absent", () => {
    stubDenoEnv({});
    expect(getRequiredRuntimeEnv("MISSING")).toBeUndefined();
  });

  it("returns undefined when the runtime is unavailable", () => {
    vi.stubGlobal("Deno", undefined);
    expect(getRequiredRuntimeEnv("MY_VAR")).toBeUndefined();
  });
});

describe("getRequiredRuntimeUrl", () => {
  it("strips a trailing slash", () => {
    stubDenoEnv({ SUPABASE_URL: "https://example.com/" });
    expect(getRequiredRuntimeUrl("SUPABASE_URL")).toBe("https://example.com");
  });

  it("leaves a value without a trailing slash unchanged", () => {
    stubDenoEnv({ SUPABASE_URL: "https://example.com" });
    expect(getRequiredRuntimeUrl("SUPABASE_URL")).toBe("https://example.com");
  });

  it("returns undefined when the variable is absent", () => {
    stubDenoEnv({});
    expect(getRequiredRuntimeUrl("SUPABASE_URL")).toBeUndefined();
  });

  it("returns undefined when the runtime is unavailable", () => {
    vi.stubGlobal("Deno", undefined);
    expect(getRequiredRuntimeUrl("SUPABASE_URL")).toBeUndefined();
  });
});
