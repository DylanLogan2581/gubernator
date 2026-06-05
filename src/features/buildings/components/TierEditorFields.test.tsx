import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { JobDefinition } from "@/features/jobs";
import type { Resource } from "@/features/resources";

import { CostEditor, EffectsEditor } from "./TierEditorFields";

const RESOURCE_ID = "00000000-0000-0000-0000-000000000001";
const JOB_ID = "00000000-0000-0000-0000-000000000002";

const ACTIVE_RESOURCES = [
  { id: RESOURCE_ID, name: "Wood" },
] as unknown as Resource[];

const ACTIVE_JOBS = [
  { id: JOB_ID, name: "Farming" },
] as unknown as JobDefinition[];

// Simulate a non-secure context by removing crypto.randomUUID before each test
// and restoring it after. This exercises the getRandomValues fallback path.
let savedRandomUUID: typeof crypto.randomUUID;

beforeEach(() => {
  savedRandomUUID = crypto.randomUUID.bind(crypto);
  delete (crypto as { randomUUID?: typeof crypto.randomUUID }).randomUUID;
});

afterEach(() => {
  crypto.randomUUID = savedRandomUUID;
});

describe("CostEditor — Add cost button in non-secure context", () => {
  it("appends a new row when Add cost is clicked and crypto.randomUUID is unavailable", async () => {
    const user = userEvent.setup();
    const rows: Parameters<typeof CostEditor>[0]["rows"] = [];
    let captured: typeof rows = rows;

    render(
      <CostEditor
        activeResources={[...ACTIVE_RESOURCES]}
        disabled={false}
        label="Construction costs"
        rows={rows}
        onChange={(r) => {
          captured = r;
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add cost" }));

    expect(captured).toHaveLength(1);
    expect(captured[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(captured[0].resourceId).toBe("");
    expect(captured[0].amount).toBe("");
  });
});

describe("EffectsEditor — Add effect button in non-secure context", () => {
  it("appends a new row when Add effect is clicked and crypto.randomUUID is unavailable", async () => {
    const user = userEvent.setup();
    const rows: Parameters<typeof EffectsEditor>[0]["rows"] = [];
    let captured: typeof rows = rows;

    render(
      <EffectsEditor
        activeJobs={[...ACTIVE_JOBS]}
        activeResources={[...ACTIVE_RESOURCES]}
        disabled={false}
        rows={rows}
        onChange={(r) => {
          captured = r;
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add effect" }));

    expect(captured).toHaveLength(1);
    expect(captured[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(captured[0].effectType).toBe("");
    expect(captured[0].amount).toBe("");
  });
});
