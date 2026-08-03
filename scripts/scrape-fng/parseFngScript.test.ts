import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { generatedConfigSchema } from "./generatedConfigSchema.ts";
import { parseFngScript } from "./parseFngScript.ts";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), "utf-8");
}

describe("parseFngScript", () => {
  it("converts a syllable-style generator with a surname (dwarfNames)", () => {
    const result = parseFngScript(loadFixture("dwarfNames.js"));
    expect(result.status).toBe("converted");
    if (result.status !== "converted") return;

    expect(generatedConfigSchema.safeParse(result.config).success).toBe(true);
    expect(result.config.convention).toBe("pool");
    expect(result.config.patterns.female_given).toEqual([
      ["nm4"],
      ["nm5"],
      ["nm6"],
    ]);
    expect(result.config.patterns.male_given).toEqual([
      ["nm1"],
      ["nm2"],
      ["nm3"],
    ]);
    expect(result.config.patterns.surname).toEqual([["nm7"], ["nm8"]]);
    expect(result.config.parts.nm1?.length).toBeGreaterThan(0);
  });

  it("converts a syllable-style generator with a surname (goblinNames)", () => {
    const result = parseFngScript(loadFixture("goblinNames.js"));
    expect(result.status).toBe("converted");
    if (result.status !== "converted") return;
    expect(generatedConfigSchema.safeParse(result.config).success).toBe(true);
    expect(result.config.convention).toBe("pool");
  });

  it("converts a whole-word generator with no surname (orcNames)", () => {
    const result = parseFngScript(loadFixture("orcNames.js"));
    expect(result.status).toBe("converted");
    if (result.status !== "converted") return;
    expect(generatedConfigSchema.safeParse(result.config).success).toBe(true);
    expect(result.config.convention).toBe("none");
    expect(result.config.patterns.surname).toEqual([]);
    expect(result.config.patterns.female_given).toEqual([["nm2"]]);
    expect(result.config.patterns.male_given).toEqual([["nm1"]]);
  });

  it("strips parenthetical meaning annotations from real-culture entries (zuluNames)", () => {
    const result = parseFngScript(loadFixture("zuluNames.js"));
    expect(result.status).toBe("converted");
    if (result.status !== "converted") return;
    expect(generatedConfigSchema.safeParse(result.config).success).toBe(true);
    const allEntries = Object.values(result.config.parts).flat();
    expect(allEntries.some((entry) => entry.includes("("))).toBe(false);
    expect(allEntries).toContain("Thando");
  });

  it("flags a generator with a third gender/type branch (elfNames)", () => {
    const result = parseFngScript(loadFixture("elfNames.js"));
    expect(result.status).toBe("flagged");
    if (result.status !== "flagged") return;
    expect(result.reason).toMatch(/more than two gender branches/);
  });

  it("flags a generator using custom expression logic (toUpperCase)", () => {
    const result = parseFngScript(loadFixture("customLogicNames.js"));
    expect(result.status).toBe("flagged");
    if (result.status !== "flagged") return;
    expect(result.reason).toMatch(/unsupported expression construct/);
  });

  it("flags scripts with no nm* arrays", () => {
    const result = parseFngScript("function nameGen(type) { names = 'x'; }");
    expect(result.status).toBe("flagged");
    if (result.status !== "flagged") return;
    expect(result.reason).toMatch(/no nm\* arrays found/);
  });
});
