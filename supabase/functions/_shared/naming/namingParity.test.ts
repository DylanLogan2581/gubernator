// Verifies the Deno simulation and the browser client resolve name
// generation to the exact same engine (#1252): this file re-exports
// src/shared/naming/index.ts verbatim, so a generateName() call reached via
// either import path must agree for the same seed/config. Pins the
// re-export against silent drift.
import { describe, expect, it } from "vitest";

import { mulberry32 } from "@/lib/seededRng";
import { generateName as generateNameViaClientPath } from "@/shared/naming";

import { generateName as generateNameViaDenoPath } from "./index.ts";

const LIST_CONFIG = {
  type: "list" as const,
  convention: "family-name" as const,
  female_given_names: ["Astrid", "Freya", "Runa"],
  male_given_names: ["Erik", "Bjorn", "Sigurd"],
  surnames: ["Ironwood", "Silverleaf", "Stormborn"],
};

const GENERATED_CONFIG = {
  type: "generated" as const,
  convention: "patronymic" as const,
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

describe("naming cross-runtime parity", () => {
  it.each([
    { config: LIST_CONFIG, label: "list" },
    { config: GENERATED_CONFIG, label: "generated" },
  ])(
    "matches for a $label config with the same seed and parents",
    ({ config }) => {
      const parentA = { givenName: "Erik", sex: "male", surname: "Ironwood" };
      const parentB = {
        givenName: "Astrid",
        sex: "female",
        surname: "Silverleaf",
      };

      for (const sex of ["male", "female"] as const) {
        const viaClientPath = generateNameViaClientPath({
          config,
          parentA,
          parentB,
          rng: mulberry32(99),
          sex,
        });
        const viaDenoPath = generateNameViaDenoPath({
          config,
          parentA,
          parentB,
          rng: mulberry32(99),
          sex,
        });

        expect(viaClientPath).toEqual(viaDenoPath);
      }
    },
  );
});
