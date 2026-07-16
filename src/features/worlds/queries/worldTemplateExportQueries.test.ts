import { describe, expect, it } from "vitest";

import { WORLD_TEMPLATE_VERSION } from "@/shared/worldTemplateSchema";

import {
  describeWorldTemplateExportError,
  parseWorldTemplate,
  WorldTemplateExportError,
} from "./worldTemplateExportQueries";

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

describe("describeWorldTemplateExportError", () => {
  it.each([
    ["forbidden", "You do not have permission to export this world template."],
    ["unauthenticated", "Your session has expired. Sign in again and retry."],
    [
      "rate_limit_exceeded",
      "Too many export attempts. Please wait a moment and try again.",
    ],
    [
      "origin_not_allowed",
      "This app is not allowed to export templates. Contact an administrator.",
    ],
    [
      "authorization_check_failed",
      "Could not verify your permissions. Please try again.",
    ],
    ["world_not_found", "World not found."],
  ])("maps %s to a specific message", (code, expectedMessage) => {
    const error = new WorldTemplateExportError({
      code,
      message: "irrelevant server message",
      worldId: "world-1",
    });
    expect(describeWorldTemplateExportError(error)).toBe(expectedMessage);
  });

  it("falls back to a generic message for unknown error codes", () => {
    const error = new WorldTemplateExportError({
      code: "fetch_failed",
      message: "irrelevant server message",
      worldId: "world-1",
    });
    expect(describeWorldTemplateExportError(error)).toBe(
      "Could not export world template. Please try again.",
    );
  });

  it("falls back to a generic message for non-export errors", () => {
    expect(describeWorldTemplateExportError(new Error("boom"))).toBe(
      "Could not export world template. Please try again.",
    );
  });
});
