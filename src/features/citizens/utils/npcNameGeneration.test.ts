import { describe, expect, it } from "vitest";

import type { WorldNamingConfig } from "@/features/worlds";
import { mulberry32 } from "@/lib/seededRng";

import {
  generateNpcName,
  relevantPoolIsEmpty,
  type NpcNameGenerationInput,
} from "./npcNameGeneration";

const MALE_NAMES = ["Erik", "Bjorn", "Sigurd"];
const FEMALE_NAMES = ["Astrid", "Freya", "Runa"];

function config(overrides: Partial<WorldNamingConfig> = {}): WorldNamingConfig {
  return {
    convention: "random",
    female_names: FEMALE_NAMES,
    male_names: MALE_NAMES,
    manual_only: false,
    ...overrides,
  };
}

function input(
  overrides: Partial<NpcNameGenerationInput>,
): NpcNameGenerationInput {
  return {
    config: config(),
    rng: mulberry32(1),
    ...overrides,
  };
}

describe("generateNpcName — pool selection", () => {
  it("uses the male pool when sex is 'male'", () => {
    const name = generateNpcName(input({ sex: "male" }));
    expect(MALE_NAMES).toContain(name);
  });

  it("uses the male pool when sex is 'M' (case-insensitive)", () => {
    const name = generateNpcName(input({ sex: "M" }));
    expect(MALE_NAMES).toContain(name);
  });

  it("uses the female pool when sex is 'female'", () => {
    const name = generateNpcName(input({ sex: "female" }));
    expect(FEMALE_NAMES).toContain(name);
  });

  it("uses the female pool when sex is 'F' (case-insensitive)", () => {
    const name = generateNpcName(input({ sex: "F" }));
    expect(FEMALE_NAMES).toContain(name);
  });

  it("uses combined pool when sex is empty", () => {
    const combined = [...MALE_NAMES, ...FEMALE_NAMES];
    const name = generateNpcName(input({ sex: "" }));
    expect(combined).toContain(name);
  });

  it("uses combined pool when sex is null", () => {
    const combined = [...MALE_NAMES, ...FEMALE_NAMES];
    const name = generateNpcName(input({ sex: null }));
    expect(combined).toContain(name);
  });

  it("uses combined pool for an unrecognized sex value", () => {
    const combined = [...MALE_NAMES, ...FEMALE_NAMES];
    const name = generateNpcName(input({ sex: "nonbinary" }));
    expect(combined).toContain(name);
  });

  it("returns empty string when the relevant pool is empty", () => {
    const name = generateNpcName(
      input({ config: config({ male_names: [] }), sex: "male" }),
    );
    expect(name).toBe("");
  });

  it("returns empty string when both pools are empty and sex is unset", () => {
    const name = generateNpcName(
      input({
        config: config({ male_names: [], female_names: [] }),
        sex: null,
      }),
    );
    expect(name).toBe("");
  });
});

describe("generateNpcName — random convention", () => {
  it("returns only a given name with no surname", () => {
    const name = generateNpcName(
      input({ config: config({ convention: "random" }), sex: "male" }),
    );
    expect(MALE_NAMES).toContain(name);
    expect(name).not.toContain(" ");
  });

  it("is deterministic for the same seed", () => {
    const a = generateNpcName(input({ rng: mulberry32(42) }));
    const b = generateNpcName(input({ rng: mulberry32(42) }));
    expect(a).toBe(b);
  });
});

describe("generateNpcName — patronymic convention", () => {
  it("appends the first word of parent A's name as a surname", () => {
    const name = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAName: "Erik the Mighty",
        sex: "male",
      }),
    );
    expect(name).toMatch(/^(Erik|Bjorn|Sigurd) Erik$/);
  });

  it("falls back to given name only when parent A is not set", () => {
    const name = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAName: null,
        sex: "male",
      }),
    );
    expect(MALE_NAMES).toContain(name);
    expect(name).not.toContain(" ");
  });

  it("falls back to given name only when parent A name is blank", () => {
    const name = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAName: "   ",
        sex: "male",
      }),
    );
    expect(MALE_NAMES).toContain(name);
    expect(name).not.toContain(" ");
  });

  it("ignores parent B for patronymic", () => {
    const withB = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAName: null,
        parentBName: "Freya",
        rng: mulberry32(5),
      }),
    );
    const withoutB = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAName: null,
        parentBName: null,
        rng: mulberry32(5),
      }),
    );
    expect(withB).toBe(withoutB);
  });
});

describe("generateNpcName — matronymic convention", () => {
  it("appends the first word of parent B's name as a surname", () => {
    const name = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentBName: "Astrid Ironwood",
        sex: "male",
      }),
    );
    expect(name).toMatch(/^(Erik|Bjorn|Sigurd) Astrid$/);
  });

  it("falls back to given name only when parent B is not set", () => {
    const name = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentBName: null,
        sex: "male",
      }),
    );
    expect(MALE_NAMES).toContain(name);
    expect(name).not.toContain(" ");
  });

  it("ignores parent A for matronymic", () => {
    const withA = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentAName: "Bjorn",
        parentBName: null,
        rng: mulberry32(5),
      }),
    );
    const withoutA = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentAName: null,
        parentBName: null,
        rng: mulberry32(5),
      }),
    );
    expect(withA).toBe(withoutA);
  });
});

describe("generateNpcName — inherited family name convention", () => {
  it("appends the last word of parent A's name as a surname", () => {
    const name = generateNpcName(
      input({
        config: config({ convention: "inherited family name" }),
        parentAName: "Erik Ironwood",
        sex: "male",
      }),
    );
    expect(name).toMatch(/^(Erik|Bjorn|Sigurd) Ironwood$/);
  });

  it("falls back to parent B's last word when parent A is not set", () => {
    const name = generateNpcName(
      input({
        config: config({ convention: "inherited family name" }),
        parentAName: null,
        parentBName: "Astrid Silverleaf",
        sex: "male",
      }),
    );
    expect(name).toMatch(/^(Erik|Bjorn|Sigurd) Silverleaf$/);
  });

  it("returns given name only when neither parent is set", () => {
    const name = generateNpcName(
      input({
        config: config({ convention: "inherited family name" }),
        parentAName: null,
        parentBName: null,
        sex: "male",
      }),
    );
    expect(MALE_NAMES).toContain(name);
    expect(name).not.toContain(" ");
  });

  it("prefers parent A over parent B when both are set", () => {
    const name = generateNpcName(
      input({
        config: config({ convention: "inherited family name" }),
        parentAName: "Erik Ironwood",
        parentBName: "Astrid Silverleaf",
        rng: mulberry32(0),
        sex: "male",
      }),
    );
    expect(name).toContain("Ironwood");
    expect(name).not.toContain("Silverleaf");
  });
});

describe("generateNpcName — length cap", () => {
  it("caps the result at citizenNameMax (64 characters)", () => {
    const longName = "A".repeat(60);
    const name = generateNpcName(
      input({
        config: config({
          convention: "patronymic",
          male_names: [longName],
        }),
        parentAName: "B".repeat(60),
        sex: "male",
      }),
    );
    expect(name.length).toBeLessThanOrEqual(64);
  });
});

describe("relevantPoolIsEmpty", () => {
  it("returns false when the male pool has entries and sex is male", () => {
    expect(relevantPoolIsEmpty(config(), "male")).toBe(false);
  });

  it("returns true when the male pool is empty and sex is male", () => {
    expect(relevantPoolIsEmpty(config({ male_names: [] }), "male")).toBe(true);
  });

  it("returns false when the female pool has entries and sex is female", () => {
    expect(relevantPoolIsEmpty(config(), "female")).toBe(false);
  });

  it("returns true when the female pool is empty and sex is female", () => {
    expect(relevantPoolIsEmpty(config({ female_names: [] }), "female")).toBe(
      true,
    );
  });

  it("returns false when either pool has entries and sex is unset", () => {
    expect(
      relevantPoolIsEmpty(
        config({ male_names: [], female_names: ["Astrid"] }),
        null,
      ),
    ).toBe(false);
  });

  it("returns true when both pools are empty and sex is unset", () => {
    expect(
      relevantPoolIsEmpty(config({ male_names: [], female_names: [] }), null),
    ).toBe(true);
  });
});
