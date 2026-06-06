import { describe, expect, it } from "vitest";

import { mulberry32 } from "@/lib/seededRng";
import type { WorldNamingConfig } from "@/lib/worldNamingConfigSchemas";

import {
  generateNpcName,
  relevantPoolIsEmpty,
  type NpcNameGenerationInput,
} from "./npcNameGeneration";

const MALE_NAMES = ["Erik", "Bjorn", "Sigurd"];
const FEMALE_NAMES = ["Astrid", "Freya", "Runa"];
const SURNAMES = ["Ironwood", "Silverleaf", "Stormborn"];

function config(overrides: Partial<WorldNamingConfig> = {}): WorldNamingConfig {
  return {
    convention: "random",
    female_given_names: FEMALE_NAMES,
    male_given_names: MALE_NAMES,
    surnames: SURNAMES,
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
    const result = generateNpcName(input({ sex: "male" }));
    expect(MALE_NAMES).toContain(result.givenName);
  });

  it("uses the male pool when sex is 'M' (case-insensitive)", () => {
    const result = generateNpcName(input({ sex: "M" }));
    expect(MALE_NAMES).toContain(result.givenName);
  });

  it("uses the female pool when sex is 'female'", () => {
    const result = generateNpcName(input({ sex: "female" }));
    expect(FEMALE_NAMES).toContain(result.givenName);
  });

  it("uses the female pool when sex is 'F' (case-insensitive)", () => {
    const result = generateNpcName(input({ sex: "F" }));
    expect(FEMALE_NAMES).toContain(result.givenName);
  });

  it("uses combined pool when sex is empty", () => {
    const combined = [...MALE_NAMES, ...FEMALE_NAMES];
    const result = generateNpcName(input({ sex: "" }));
    expect(combined).toContain(result.givenName);
  });

  it("uses combined pool when sex is null", () => {
    const combined = [...MALE_NAMES, ...FEMALE_NAMES];
    const result = generateNpcName(input({ sex: null }));
    expect(combined).toContain(result.givenName);
  });

  it("uses combined pool for an unrecognized sex value", () => {
    const combined = [...MALE_NAMES, ...FEMALE_NAMES];
    const result = generateNpcName(input({ sex: "nonbinary" }));
    expect(combined).toContain(result.givenName);
  });

  it("returns empty givenName when the relevant pool is empty", () => {
    const result = generateNpcName(
      input({ config: config({ male_given_names: [] }), sex: "male" }),
    );
    expect(result.givenName).toBe("");
    expect(result.surname).toBeNull();
  });

  it("returns empty givenName when both pools are empty and sex is unset", () => {
    const result = generateNpcName(
      input({
        config: config({ male_given_names: [], female_given_names: [] }),
        sex: null,
      }),
    );
    expect(result.givenName).toBe("");
    expect(result.surname).toBeNull();
  });
});

describe("generateNpcName — random convention", () => {
  it("picks a surname from the surnames pool", () => {
    const result = generateNpcName(
      input({ config: config({ convention: "random" }), sex: "male" }),
    );
    expect(MALE_NAMES).toContain(result.givenName);
    expect(SURNAMES).toContain(result.surname);
  });

  it("returns null surname when the surnames pool is empty", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "random", surnames: [] }),
        sex: "male",
      }),
    );
    expect(result.surname).toBeNull();
  });

  it("is deterministic for the same seed", () => {
    const a = generateNpcName(input({ rng: mulberry32(42) }));
    const b = generateNpcName(input({ rng: mulberry32(42) }));
    expect(a.givenName).toBe(b.givenName);
    expect(a.surname).toBe(b.surname);
  });
});

describe("generateNpcName — patronymic convention", () => {
  it("uses parent A's given name as the surname", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAGivenName: "Erik",
        sex: "male",
      }),
    );
    expect(MALE_NAMES).toContain(result.givenName);
    expect(result.surname).toBe("Erik");
  });

  it("returns null surname when parent A given name is not set", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAGivenName: null,
        sex: "male",
      }),
    );
    expect(MALE_NAMES).toContain(result.givenName);
    expect(result.surname).toBeNull();
  });

  it("returns null surname when parent A given name is blank", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAGivenName: "   ",
        sex: "male",
      }),
    );
    expect(result.surname).toBeNull();
  });

  it("ignores parent B for patronymic", () => {
    const withB = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAGivenName: null,
        parentBGivenName: "Freya",
        rng: mulberry32(5),
      }),
    );
    const withoutB = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAGivenName: null,
        parentBGivenName: null,
        rng: mulberry32(5),
      }),
    );
    expect(withB.surname).toBe(withoutB.surname);
  });
});

describe("generateNpcName — matronymic convention", () => {
  it("uses parent B's given name as the surname", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentBGivenName: "Astrid",
        sex: "male",
      }),
    );
    expect(MALE_NAMES).toContain(result.givenName);
    expect(result.surname).toBe("Astrid");
  });

  it("returns null surname when parent B given name is not set", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentBGivenName: null,
        sex: "male",
      }),
    );
    expect(result.surname).toBeNull();
  });

  it("ignores parent A for matronymic", () => {
    const withA = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentAGivenName: "Bjorn",
        parentBGivenName: null,
        rng: mulberry32(5),
      }),
    );
    const withoutA = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentAGivenName: null,
        parentBGivenName: null,
        rng: mulberry32(5),
      }),
    );
    expect(withA.surname).toBe(withoutA.surname);
  });
});

describe("generateNpcName — inherited family name convention", () => {
  it("uses parent A's surname", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "inherited family name" }),
        parentASurname: "Ironwood",
        sex: "male",
      }),
    );
    expect(result.surname).toBe("Ironwood");
  });

  it("falls back to parent B's surname when parent A has none", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "inherited family name" }),
        parentASurname: null,
        parentBSurname: "Silverleaf",
        sex: "male",
      }),
    );
    expect(result.surname).toBe("Silverleaf");
  });

  it("returns null surname when neither parent has a surname", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "inherited family name" }),
        parentASurname: null,
        parentBSurname: null,
        sex: "male",
      }),
    );
    expect(result.surname).toBeNull();
  });

  it("prefers parent A's surname over parent B's", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "inherited family name" }),
        parentASurname: "Ironwood",
        parentBSurname: "Silverleaf",
        sex: "male",
      }),
    );
    expect(result.surname).toBe("Ironwood");
  });
});

describe("generateNpcName — manual convention", () => {
  it("returns null surname regardless of parents", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "manual" }),
        parentAGivenName: "Erik",
        parentASurname: "Ironwood",
        sex: "male",
      }),
    );
    expect(MALE_NAMES).toContain(result.givenName);
    expect(result.surname).toBeNull();
  });
});

describe("relevantPoolIsEmpty", () => {
  it("returns false when the male pool has entries and sex is male", () => {
    expect(relevantPoolIsEmpty(config(), "male")).toBe(false);
  });

  it("returns true when the male pool is empty and sex is male", () => {
    expect(relevantPoolIsEmpty(config({ male_given_names: [] }), "male")).toBe(
      true,
    );
  });

  it("returns false when the female pool has entries and sex is female", () => {
    expect(relevantPoolIsEmpty(config(), "female")).toBe(false);
  });

  it("returns true when the female pool is empty and sex is female", () => {
    expect(
      relevantPoolIsEmpty(config({ female_given_names: [] }), "female"),
    ).toBe(true);
  });

  it("returns false when either pool has entries and sex is unset", () => {
    expect(
      relevantPoolIsEmpty(
        config({ male_given_names: [], female_given_names: ["Astrid"] }),
        null,
      ),
    ).toBe(false);
  });

  it("returns true when both pools are empty and sex is unset", () => {
    expect(
      relevantPoolIsEmpty(
        config({ male_given_names: [], female_given_names: [] }),
        null,
      ),
    ).toBe(true);
  });
});
