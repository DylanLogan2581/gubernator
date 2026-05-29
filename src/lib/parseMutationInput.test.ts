import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseMutationInput } from "./parseMutationInput";

const schema = z.object({
  name: z.string().min(1, "name is required"),
  age: z.number().int().positive("age must be positive"),
});

class TestError extends Error {
  readonly issues: readonly { message: string; path: readonly PropertyKey[] }[];

  constructor(
    issues: readonly { message: string; path: readonly PropertyKey[] }[],
  ) {
    super("input invalid");
    this.name = "TestError";
    this.issues = issues;
  }
}

describe("parseMutationInput", () => {
  it("returns parsed data when input is valid", () => {
    const result = parseMutationInput(
      schema,
      { name: "Alice", age: 30 },
      (issues) => new TestError(issues),
    );
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("throws the error produced by toError when input is invalid", () => {
    expect(() =>
      parseMutationInput(
        schema,
        { name: "", age: 30 },
        (issues) => new TestError(issues),
      ),
    ).toThrow(TestError);
  });

  it("passes zod issues to toError on failure", () => {
    let capturedIssues: readonly {
      message: string;
      path: readonly PropertyKey[];
    }[] = [];
    try {
      parseMutationInput(schema, { name: "", age: -1 }, (issues) => {
        capturedIssues = issues;
        return new TestError(issues);
      });
    } catch {
      // expected
    }
    expect(capturedIssues.length).toBeGreaterThan(0);
    expect(typeof capturedIssues[0]?.message).toBe("string");
  });

  it("includes the issue path for nested fields", () => {
    let capturedIssues: readonly {
      message: string;
      path: readonly PropertyKey[];
    }[] = [];
    try {
      parseMutationInput(schema, { name: "", age: 30 }, (issues) => {
        capturedIssues = issues;
        return new TestError(issues);
      });
    } catch {
      // expected
    }
    const nameIssue = capturedIssues.find((i) => i.path.includes("name"));
    expect(nameIssue).toBeDefined();
    expect(nameIssue?.message).toBe("name is required");
  });

  it("infers the output type of the schema", () => {
    const result = parseMutationInput(
      z.object({ value: z.string().transform((s) => s.toUpperCase()) }),
      { value: "hello" },
      (issues) => new TestError(issues),
    );
    expect(result.value).toBe("HELLO");
  });
});
