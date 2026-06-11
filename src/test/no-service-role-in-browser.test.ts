import { describe, expect, it } from "vitest";

const sourceFiles = import.meta.glob<string>("../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const FORBIDDEN_PATTERN = "import.meta.env." + "SUPABASE_SERVICE_ROLE_KEY";

describe("service-role key browser exclusion", () => {
  it("does not reference SUPABASE_SERVICE_ROLE_KEY via import.meta.env in any browser source file", () => {
    const violatingPaths: string[] = [];

    for (const [filePath, content] of Object.entries(sourceFiles)) {
      if (filePath.includes("/test/")) continue;
      if (content.includes(FORBIDDEN_PATTERN)) {
        violatingPaths.push(filePath);
      }
    }

    expect(violatingPaths).toEqual([]);
  });
});
