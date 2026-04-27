import { describe, expect, it } from "vitest";

import { authQueryKeys } from "./authQueryKeys";

describe("authQueryKeys", () => {
  it("centralizes auth query key roots", () => {
    expect(authQueryKeys.all).toEqual(["auth"]);
  });

  it("creates stable current session keys", () => {
    expect(authQueryKeys.currentSession()).toEqual(["auth", "current-session"]);
  });

  it("creates stable current app user keys", () => {
    expect(authQueryKeys.currentAppUser()).toEqual([
      "auth",
      "current-app-user",
    ]);
  });
});
