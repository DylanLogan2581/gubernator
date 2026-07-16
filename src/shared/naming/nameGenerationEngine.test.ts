import { describe, expect, it } from "vitest";

import { mulberry32 } from "@/lib/seededRng";

import {
  generateFromPattern,
  generateGivenName,
  generateName,
  isGivenNamePoolEmpty,
  resolveSurname,
} from "./nameGenerationEngine";

import type {
  GeneratedNamingConfig,
  ListNamingConfig,
} from "./namingConfigTypes";

const LIST_CONFIG: ListNamingConfig = {
  type: "list",
  convention: "pool",
  female_given_names: ["Astrid", "Freya", "Runa"],
  male_given_names: ["Erik", "Bjorn", "Sigurd"],
  surnames: ["Ironwood", "Silverleaf", "Stormborn"],
};

const GENERATED_CONFIG: GeneratedNamingConfig = {
  type: "generated",
  convention: "pool",
  parts: {
    m_onset: ["A", "Bra"],
    m_coda: ["dan", "lin"],
    f_onset: ["Els", "Mira"],
    f_coda: ["a", "wyn"],
    surname_root: ["Stone", "Wolf"],
  },
  patterns: {
    female_given: [["f_onset", "f_coda"]],
    male_given: [["m_onset", "m_coda"]],
    surname: [["surname_root"], "born"],
  },
};

describe("generateFromPattern", () => {
  it("concatenates one pick per list in a group, in order", () => {
    // rng() always returns 0 -> always picks the first entry of each list.
    const rng = (): number => 0;
    expect(generateFromPattern(rng, GENERATED_CONFIG, "male_given")).toBe(
      "Adan",
    );
  });

  it("interleaves literal strings with list-ref groups", () => {
    const rng = (): number => 0;
    expect(generateFromPattern(rng, GENERATED_CONFIG, "surname")).toBe(
      "Stoneborn",
    );
  });

  it("is deterministic for a fixed seed", () => {
    const a = generateFromPattern(
      mulberry32(7),
      GENERATED_CONFIG,
      "male_given",
    );
    const b = generateFromPattern(
      mulberry32(7),
      GENERATED_CONFIG,
      "male_given",
    );
    expect(a).toBe(b);
  });

  it("skips unknown or empty referenced lists without throwing", () => {
    const config: GeneratedNamingConfig = {
      ...GENERATED_CONFIG,
      patterns: {
        ...GENERATED_CONFIG.patterns,
        male_given: [["missing_list", "m_onset"]],
      },
    };
    expect(generateFromPattern(() => 0, config, "male_given")).toBe("A");
  });
});

describe("generateGivenName", () => {
  it("picks from the male list pool when sex is male", () => {
    const name = generateGivenName(mulberry32(1), LIST_CONFIG, "male");
    expect(LIST_CONFIG.male_given_names).toContain(name);
  });

  it("picks from the female pattern when sex is female", () => {
    const name = generateGivenName(mulberry32(1), GENERATED_CONFIG, "female");
    expect(["Elsa", "Elswyn", "Miraa", "Mirawyn"]).toContain(name);
  });

  it("falls back to a random gendered pattern when sex is unset (generated)", () => {
    const rng = mulberry32(3);
    const name = generateGivenName(rng, GENERATED_CONFIG, null);
    expect(name.length).toBeGreaterThan(0);
  });
});

describe("resolveSurname — conventions", () => {
  const parentA = { givenName: "Erik", sex: "male", surname: "Ironwood" };
  const parentB = { givenName: "Astrid", sex: "female", surname: "Silverleaf" };

  it("pool: picks from the surnames list", () => {
    const surname = resolveSurname(
      mulberry32(1),
      LIST_CONFIG,
      "pool",
      null,
      null,
    );
    expect(LIST_CONFIG.surnames).toContain(surname);
  });

  it("pool: generates from the surname pattern for a generated config", () => {
    const surname = resolveSurname(
      () => 0,
      GENERATED_CONFIG,
      "pool",
      null,
      null,
    );
    expect(surname).toBe("Stoneborn");
  });

  it("none: always returns null", () => {
    expect(
      resolveSurname(mulberry32(1), LIST_CONFIG, "none", parentA, parentB),
    ).toBeNull();
  });

  it("patronymic: uses the male parent's given name", () => {
    expect(
      resolveSurname(
        mulberry32(1),
        LIST_CONFIG,
        "patronymic",
        parentA,
        parentB,
      ),
    ).toBe("Erik");
  });

  it("matronymic: uses the female parent's given name", () => {
    expect(
      resolveSurname(
        mulberry32(1),
        LIST_CONFIG,
        "matronymic",
        parentA,
        parentB,
      ),
    ).toBe("Astrid");
  });

  it("family-name: inherits a parent's surname (50/50)", () => {
    const seen = new Set<string | null>();
    for (let seed = 0; seed < 32; seed++) {
      seen.add(
        resolveSurname(
          mulberry32(seed),
          LIST_CONFIG,
          "family-name",
          parentA,
          parentB,
        ),
      );
    }
    expect(seen).toEqual(new Set(["Ironwood", "Silverleaf"]));
  });
});

describe("generateName", () => {
  it("is deterministic for a fixed seed", () => {
    const a = generateName({
      config: LIST_CONFIG,
      rng: mulberry32(42),
      sex: "male",
    });
    const b = generateName({
      config: LIST_CONFIG,
      rng: mulberry32(42),
      sex: "male",
    });
    expect(a).toEqual(b);
  });

  it("returns an empty given name and null surname when the pool is empty", () => {
    const emptyConfig: ListNamingConfig = {
      ...LIST_CONFIG,
      male_given_names: [],
    };
    const result = generateName({
      config: emptyConfig,
      rng: mulberry32(1),
      sex: "male",
    });
    expect(result).toEqual({ givenName: "", surname: null });
  });

  it("generates a full name from a generated config", () => {
    const result = generateName({
      config: GENERATED_CONFIG,
      rng: () => 0,
      sex: "male",
    });
    expect(result).toEqual({ givenName: "Adan", surname: "Stoneborn" });
  });
});

describe("isGivenNamePoolEmpty", () => {
  it("list: true when the relevant pool is empty", () => {
    const config: ListNamingConfig = { ...LIST_CONFIG, male_given_names: [] };
    expect(isGivenNamePoolEmpty(config, "male")).toBe(true);
    expect(isGivenNamePoolEmpty(config, "female")).toBe(false);
  });

  it("generated: true when every list referenced by the pattern is empty", () => {
    const config: GeneratedNamingConfig = {
      ...GENERATED_CONFIG,
      parts: { ...GENERATED_CONFIG.parts, m_onset: [], m_coda: [] },
    };
    expect(isGivenNamePoolEmpty(config, "male")).toBe(true);
    expect(isGivenNamePoolEmpty(config, "female")).toBe(false);
  });

  it("generated: false when the pattern has a literal or non-empty group", () => {
    expect(isGivenNamePoolEmpty(GENERATED_CONFIG, "male")).toBe(false);
  });
});
