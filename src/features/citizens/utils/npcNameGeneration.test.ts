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
    convention: "pool",
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

describe("generateNpcName — pool convention", () => {
  it("picks a surname from the surnames pool", () => {
    const result = generateNpcName(
      input({ config: config({ convention: "pool" }), sex: "male" }),
    );
    expect(MALE_NAMES).toContain(result.givenName);
    expect(SURNAMES).toContain(result.surname);
  });

  it("returns null surname when the surnames pool is empty", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "pool", surnames: [] }),
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
  it("uses the male parent's given name regardless of slot (parent A male)", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAGivenName: "Erik",
        parentASex: "male",
        parentBGivenName: "Astrid",
        parentBSex: "female",
        sex: "male",
      }),
    );
    expect(MALE_NAMES).toContain(result.givenName);
    expect(result.surname).toBe("Erik");
  });

  it("uses the male parent's given name when parent B is the male", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAGivenName: "Astrid",
        parentASex: "female",
        parentBGivenName: "Erik",
        parentBSex: "male",
        sex: "female",
      }),
    );
    expect(result.surname).toBe("Erik");
  });

  it("falls back to the other parent when no parent is male", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAGivenName: "Astrid",
        parentASex: "female",
        parentBGivenName: "Freya",
        parentBSex: "female",
      }),
    );
    expect(["Astrid", "Freya"]).toContain(result.surname);
  });

  it("falls back to a random pool surname when no parent has a given name", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "patronymic" }),
        parentAGivenName: null,
        parentBGivenName: "   ",
        sex: "male",
      }),
    );
    expect(SURNAMES).toContain(result.surname);
  });

  it("returns null surname when no parent and the pool is empty", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "patronymic", surnames: [] }),
        parentAGivenName: null,
        parentBGivenName: null,
        sex: "male",
      }),
    );
    expect(result.surname).toBeNull();
  });
});

describe("generateNpcName — matronymic convention", () => {
  it("uses the female parent's given name regardless of slot (parent B female)", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentAGivenName: "Erik",
        parentASex: "male",
        parentBGivenName: "Astrid",
        parentBSex: "female",
        sex: "male",
      }),
    );
    expect(result.surname).toBe("Astrid");
  });

  it("uses the female parent's given name when parent A is the female", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentAGivenName: "Astrid",
        parentASex: "female",
        parentBGivenName: "Erik",
        parentBSex: "male",
        sex: "male",
      }),
    );
    expect(result.surname).toBe("Astrid");
  });

  it("falls back to the other parent when no parent is female", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentAGivenName: "Erik",
        parentASex: "male",
        parentBGivenName: "Bjorn",
        parentBSex: "male",
      }),
    );
    expect(["Erik", "Bjorn"]).toContain(result.surname);
  });

  it("falls back to a random pool surname when no parent has a given name", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "matronymic" }),
        parentAGivenName: null,
        parentBGivenName: null,
        sex: "male",
      }),
    );
    expect(SURNAMES).toContain(result.surname);
  });
});

describe("generateNpcName — family-name convention", () => {
  it("uses a parent's surname (50/50 between the two)", () => {
    const seen = new Set<string | null>();
    for (let seed = 0; seed < 32; seed++) {
      const result = generateNpcName(
        input({
          config: config({ convention: "family-name" }),
          parentASurname: "Ironwood",
          parentBSurname: "Silverleaf",
          rng: mulberry32(seed),
          sex: "male",
        }),
      );
      seen.add(result.surname);
    }
    expect(seen).toEqual(new Set(["Ironwood", "Silverleaf"]));
  });

  it("falls back to the other parent's surname when one is missing", () => {
    for (let seed = 0; seed < 8; seed++) {
      const result = generateNpcName(
        input({
          config: config({ convention: "family-name" }),
          parentASurname: null,
          parentBSurname: "Silverleaf",
          rng: mulberry32(seed),
          sex: "male",
        }),
      );
      expect(result.surname).toBe("Silverleaf");
    }
  });

  it("falls back to a random pool surname when neither parent has a surname", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "family-name" }),
        parentASurname: null,
        parentBSurname: null,
        sex: "male",
      }),
    );
    expect(SURNAMES).toContain(result.surname);
  });
});

describe("generateNpcName — none convention", () => {
  it("returns null surname regardless of parents", () => {
    const result = generateNpcName(
      input({
        config: config({ convention: "none" }),
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
