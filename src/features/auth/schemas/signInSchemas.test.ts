import { describe, expect, it } from "vitest";

import { parseSignInSearch, signInCredentialsSchema } from "./signInSchemas";

describe("sign-in schemas", () => {
  it("accepts email and password credentials", () => {
    const result = signInCredentialsSchema.safeParse({
      email: "player@example.com",
      password: "correct-horse-battery-staple",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid credentials with field-owned messages", () => {
    const result = signInCredentialsSchema.safeParse({
      email: "not-an-email",
      password: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toEqual([
        "Enter a valid email address.",
      ]);
      expect(result.error.flatten().fieldErrors.password).toEqual([
        "Enter your password.",
      ]);
    }
  });

  it("defaults sign-in search to the world list", () => {
    expect(parseSignInSearch({})).toEqual({ returnTo: "/worlds" });
  });

  it("accepts supported return paths", () => {
    expect(parseSignInSearch({ returnTo: "/" })).toEqual({ returnTo: "/" });
    expect(parseSignInSearch({ returnTo: "/worlds" })).toEqual({
      returnTo: "/worlds",
    });
    expect(parseSignInSearch({ returnTo: "/worlds/abc?tab=overview" })).toEqual(
      {
        returnTo: "/worlds/abc?tab=overview",
      },
    );
  });

  it("rejects external return paths", () => {
    expect(parseSignInSearch({ returnTo: "https://example.com" })).toEqual({
      returnTo: "/worlds",
    });
    expect(parseSignInSearch({ returnTo: "//example.com" })).toEqual({
      returnTo: "/worlds",
    });
  });
});
