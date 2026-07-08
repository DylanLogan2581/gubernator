import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type JSX } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EducationLevel } from "@/features/education";
import type { JobDefinition } from "@/features/jobs";
import type { Resource } from "@/features/resources";

import {
  CostEditor,
  EducationConfigEditor,
  EffectsEditor,
} from "./TierEditorFields";

import type { EducationConfigRowState } from "../utils/tierEditorUtils";

const RESOURCE_ID = "00000000-0000-0000-0000-000000000001";
const JOB_ID = "00000000-0000-0000-0000-000000000002";
const LEVEL_ID = "00000000-0000-0000-0000-000000000003";

const ACTIVE_RESOURCES = [
  { id: RESOURCE_ID, name: "Wood" },
] as unknown as Resource[];

const ACTIVE_JOBS = [
  { id: JOB_ID, name: "Farming" },
] as unknown as JobDefinition[];

const ACTIVE_EDUCATION_LEVELS = [
  { id: LEVEL_ID, name: "Basic" },
] as unknown as EducationLevel[];

const NOT_A_SCHOOL: EducationConfigRowState = {
  isSchool: false,
  studentCapacity: "",
  studentsPerTeacher: "",
  teacherJobId: "",
  teachesUpToLevelId: "",
  turnsPerLevel: "",
};

function EducationConfigEditorWrapper(): JSX.Element {
  const [config, setConfig] = useState<EducationConfigRowState>({
    ...NOT_A_SCHOOL,
    isSchool: true,
  });
  return (
    <EducationConfigEditor
      activeEducationLevels={ACTIVE_EDUCATION_LEVELS}
      activeJobs={ACTIVE_JOBS}
      config={config}
      disabled={false}
      onChange={setConfig}
    />
  );
}

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

describe("EducationConfigEditor", () => {
  it("hides the five school fields when isSchool is false", () => {
    render(
      <EducationConfigEditor
        activeEducationLevels={ACTIVE_EDUCATION_LEVELS}
        activeJobs={ACTIVE_JOBS}
        config={NOT_A_SCHOOL}
        disabled={false}
        onChange={() => {}}
      />,
    );

    expect(
      screen.queryByLabelText("Teaches up to level"),
    ).not.toBeInTheDocument();
  });

  it("toggling the switch on notifies onChange with isSchool true", async () => {
    const user = userEvent.setup();
    let captured: EducationConfigRowState = NOT_A_SCHOOL;

    render(
      <EducationConfigEditor
        activeEducationLevels={ACTIVE_EDUCATION_LEVELS}
        activeJobs={ACTIVE_JOBS}
        config={NOT_A_SCHOOL}
        disabled={false}
        onChange={(c) => {
          captured = c;
        }}
      />,
    );

    await user.click(
      screen.getByRole("switch", { name: "This tier is a school" }),
    );

    expect(captured.isSchool).toBe(true);
  });

  it("reveals and wires the five school fields when isSchool is true", async () => {
    const user = userEvent.setup();

    render(<EducationConfigEditorWrapper />);

    await user.selectOptions(
      screen.getByLabelText("Teaches up to level"),
      LEVEL_ID,
    );
    expect(
      screen.getByLabelText<HTMLSelectElement>("Teaches up to level").value,
    ).toBe(LEVEL_ID);

    await user.selectOptions(screen.getByLabelText("Teacher job"), JOB_ID);
    expect(screen.getByLabelText<HTMLSelectElement>("Teacher job").value).toBe(
      JOB_ID,
    );

    await user.type(screen.getByLabelText("Student capacity"), "20");
    expect(
      screen.getByLabelText<HTMLInputElement>("Student capacity").value,
    ).toBe("20");
  });
});
