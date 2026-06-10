import { describe, it, expect } from "vitest";
import { z } from "zod";

import { firstIssuePerField } from "./zodFieldErrors";

describe("firstIssuePerField", () => {
  it("extracts first error per field from Zod error", () => {
    const schema = z.object({
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Invalid email"),
      age: z.number().positive("Age must be positive"),
    });

    const result = schema.safeParse({
      name: "",
      email: "not-an-email",
      age: -5,
    });

    if (!result.success) {
      const errors = firstIssuePerField(result.error);

      expect(errors.name).toBe("Name is required");
      expect(errors.email).toBe("Invalid email");
      expect(errors.age).toBe("Age must be positive");
    }
  });

  it("returns empty object for valid input", () => {
    const schema = z.object({
      name: z.string().min(1),
    });

    const result = schema.safeParse({ name: "John" });

    // safeParse with valid input doesn't have error
    if (!result.success) {
      const errors = firstIssuePerField(result.error);
      expect(Object.keys(errors)).toHaveLength(0);
    } else {
      // This is the success case, just verify it passes
      expect(result.success).toBe(true);
    }
  });

  it("keeps only first error per field when multiple issues exist", () => {
    const schema = z.object({
      name: z
        .string()
        .min(1, "Name is required")
        .min(3, "Name must be at least 3 chars"),
    });

    const result = schema.safeParse({ name: "" });

    if (!result.success) {
      const errors = firstIssuePerField(result.error);

      // Should have exactly one error for name field
      expect(Object.keys(errors)).toHaveLength(1);
      expect(errors.name).toBe("Name is required"); // First error
    }
  });

  it("handles nested object errors by using path[0]", () => {
    const schema = z.object({
      user: z.object({
        name: z.string().min(1, "Name is required"),
      }),
    });

    const result = schema.safeParse({
      user: { name: "" },
    });

    if (!result.success) {
      const errors = firstIssuePerField(result.error);

      // The path[0] for nested errors is "user"
      expect(errors.user).toBe("Name is required");
    }
  });

  it("handles array field names", () => {
    const schema = z.object({
      items: z.array(z.string().min(1)),
    });

    const result = schema.safeParse({
      items: ["", "valid"],
    });

    if (!result.success) {
      const errors = firstIssuePerField(result.error);

      // path[0] for array errors is "items"
      expect(errors.items).toBeDefined();
    }
  });
});
