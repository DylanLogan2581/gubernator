import { describe, expect, it } from "vitest";

import { WORLD_TEMPLATE_VERSION } from "@/shared/worldTemplateSchema";

import { parseWorldTemplate } from "./worldTemplateExportQueries";

describe("parseWorldTemplate", () => {
  it("rejects text that is not valid JSON", () => {
    const result = parseWorldTemplate("not json");
    expect(result).toEqual({ ok: false, error: "File is not valid JSON." });
  });

  it("shows a friendly message for an unsupported v1 template", () => {
    const v1Json = JSON.stringify({ template_version: 1 });
    const result = parseWorldTemplate(v1Json);
    expect(result).toEqual({
      ok: false,
      error: `Template version 1 is no longer supported. Export a new template (version ${WORLD_TEMPLATE_VERSION}) to import it.`,
    });
  });

  it("shows a friendly message when template_version is missing entirely", () => {
    const result = parseWorldTemplate(JSON.stringify({}));
    expect(result).toEqual({
      ok: false,
      error: `Unsupported template version. Export a new template (version ${WORLD_TEMPLATE_VERSION}) to import it.`,
    });
  });

  it("returns a field-scoped error for unrelated invalid fields", () => {
    const result = parseWorldTemplate(
      JSON.stringify({ template_version: WORLD_TEMPLATE_VERSION }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain("template_version");
    }
  });
});
