import { describe, expect, it } from "vitest";

import {
  CLIENT_ENV_VAR_NAMES,
  SERVER_SECRET_ENV_VAR_NAMES,
} from "@/shared/envContract";

describe("envContract — client runtime", () => {
  it("all client env var names are VITE_-prefixed (browser-safe)", () => {
    for (const name of CLIENT_ENV_VAR_NAMES) {
      expect(name, `"${name}" must start with VITE_`).toMatch(/^VITE_/);
    }
  });
});

describe("envContract — secret isolation", () => {
  it("server secret names do not appear in the client env var list", () => {
    const clientSet = new Set<string>(CLIENT_ENV_VAR_NAMES);
    for (const secret of SERVER_SECRET_ENV_VAR_NAMES) {
      expect(
        clientSet.has(secret),
        `"${secret}" must not be in CLIENT_ENV_VAR_NAMES`,
      ).toBe(false);
    }
  });

  it("server secret names are not VITE_-prefixed", () => {
    for (const name of SERVER_SECRET_ENV_VAR_NAMES) {
      expect(name, `"${name}" must not start with VITE_`).not.toMatch(/^VITE_/);
    }
  });
});
