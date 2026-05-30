import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorldJobsConfigPanel } from "./WorldJobsConfigPanel";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
  toastSuccess:
    vi.fn<(message: string, options?: { description?: string }) => void>(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const JOB_ID = "00000000-0000-0000-0000-000000000002";
const RESOURCE_ID = "00000000-0000-0000-0000-000000000003";
const DEPOSIT_TYPE_ID = "00000000-0000-0000-0000-000000000004";
const MANAGED_POP_TYPE_ID = "00000000-0000-0000-0000-000000000005";
const CULLING_JOB_ID = "00000000-0000-0000-0000-000000000006";

describe("WorldJobsConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows empty state when there are no jobs", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ jobRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("No jobs yet")).toBeDefined();
  });

  it("hides the Add job button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ jobRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No jobs yet");
    expect(screen.queryByRole("button", { name: "Add job" })).toBeNull();
  });

  it("shows job list with type badge", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [
          createJobRow({
            job_type: "standard",
            name: "Farming",
            slug: "farming",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Farming");
    const listItem = screen.getByRole("listitem");
    expect(within(listItem).getByText("Standard")).toBeDefined();
    expect(within(listItem).queryByText("farming")).toBeNull();
  });

  it("shows trashed jobs when trash view is toggled", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [
          createJobRow({ is_active: true, name: "Active Job" }),
          createJobRow({
            id: "00000000-0000-0000-0000-000000000003",
            is_active: false,
            name: "Trashed Job",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Active Job");
    expect(screen.queryByText("Trashed Job")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show trash" }));

    expect(screen.getByText("Trashed Job")).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide trash" })).toBeDefined();
  });

  it("filters jobs by type", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [
          createJobRow({ job_type: "standard", name: "Farming" }),
          createJobRow({
            id: "00000000-0000-0000-0000-000000000003",
            job_type: "trader",
            name: "Silk Road",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Farming");
    expect(screen.getByText("Silk Road")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Standard" }));

    expect(screen.getByText("Farming")).toBeDefined();
    expect(screen.queryByText("Silk Road")).toBeNull();
  });

  it("emits a success toast after creating a standard job", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        insertResult: {
          data: createJobRow({ job_type: "standard" }),
          error: null,
        },
        jobRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Jobs" });
    await user.click(screen.getByRole("button", { name: "Add job" }));

    await user.click(screen.getByRole("radio", { name: "Standard" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Farming");
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(screen.getByRole("textbox", { name: "Slug" }), "farming");

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits a success toast after creating a construction job", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        insertResult: {
          data: createJobRow({ job_type: "construction" }),
          error: null,
        },
        jobRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Jobs" });
    await user.click(screen.getByRole("button", { name: "Add job" }));

    await user.click(screen.getByRole("radio", { name: "Construction" }));
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Build Wall",
    );
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(
      screen.getByRole("textbox", { name: "Slug" }),
      "build-wall",
    );

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits a success toast after creating a trader job", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        insertResult: {
          data: createJobRow({ job_type: "trader" }),
          error: null,
        },
        jobRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Jobs" });
    await user.click(screen.getByRole("button", { name: "Add job" }));

    await user.click(screen.getByRole("radio", { name: "Trader" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Silk Road");
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(screen.getByRole("textbox", { name: "Slug" }), "silk-road");

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits a success toast after creating a deposit job", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        insertResult: {
          data: createJobRow({ job_type: "deposit" }),
          error: null,
        },
        jobRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Jobs" });
    await user.click(screen.getByRole("button", { name: "Add job" }));

    await user.click(screen.getByRole("radio", { name: "Deposit" }));
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Iron Mining",
    );
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(
      screen.getByRole("textbox", { name: "Slug" }),
      "iron-mining",
    );

    expect(
      screen.getByText(
        "You can link this job to a deposit type or managed population type after creating it from the relevant configuration tab.",
      ),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits a success toast after creating a husbandry job", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        insertResult: {
          data: createJobRow({ job_type: "husbandry" }),
          error: null,
        },
        jobRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Jobs" });
    await user.click(screen.getByRole("button", { name: "Add job" }));

    await user.click(screen.getByRole("radio", { name: "Husbandry" }));
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Sheep Herding",
    );
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(
      screen.getByRole("textbox", { name: "Slug" }),
      "sheep-herding",
    );

    expect(
      screen.getByText(
        "You can link this job to a deposit type or managed population type after creating it from the relevant configuration tab.",
      ),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits a success toast after creating a culling job", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        insertResult: {
          data: createJobRow({ job_type: "culling" }),
          error: null,
        },
        jobRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Jobs" });
    await user.click(screen.getByRole("button", { name: "Add job" }));

    await user.click(screen.getByRole("radio", { name: "Culling" }));
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Wolf Culling",
    );
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(
      screen.getByRole("textbox", { name: "Slug" }),
      "wolf-culling",
    );

    expect(
      screen.getByText(
        "You can link this job to a deposit type or managed population type after creating it from the relevant configuration tab.",
      ),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  // ── Create form — IO editor ──────────────────────────────────────────────

  it("creates a standard job with IO rows populated", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        insertResult: {
          data: createJobRow({ job_type: "standard" }),
          error: null,
        },
        jobRows: [],
        resourceRows: [createResourceRow({ name: "Grain" })],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Jobs" });
    await user.click(screen.getByRole("button", { name: "Add job" }));

    await user.click(screen.getByRole("radio", { name: "Standard" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Farming");

    await user.click(screen.getByRole("button", { name: "Add input" }));
    expect(
      screen.getByRole("combobox", { name: "Inputs entry 1 resource" }),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Add output" }));
    expect(
      screen.getByRole("combobox", { name: "Outputs entry 1 resource" }),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("does not show IO editors when construction is selected in the create form", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        insertResult: {
          data: createJobRow({ job_type: "construction" }),
          error: null,
        },
        jobRows: [],
        resourceRows: [createResourceRow()],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Jobs" });
    await user.click(screen.getByRole("button", { name: "Add job" }));

    await user.click(screen.getByRole("radio", { name: "Construction" }));
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Build Wall",
    );

    expect(screen.queryByText("Inputs")).toBeNull();
    expect(screen.queryByText("Outputs")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add input" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add output" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows a validation error when an IO row has an invalid amount in the create form", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        insertResult: {
          data: createJobRow({ job_type: "standard" }),
          error: null,
        },
        jobRows: [],
        resourceRows: [createResourceRow({ name: "Grain" })],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Jobs" });
    await user.click(screen.getByRole("button", { name: "Add job" }));

    await user.click(screen.getByRole("radio", { name: "Standard" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Farming");

    await user.click(screen.getByRole("button", { name: "Add input" }));

    const amountInput = screen.getByRole("textbox", {
      name: "Inputs entry 1 amount per worker",
    });
    await user.clear(amountInput);

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).not.toHaveBeenCalled();
    });
    expect(screen.queryByText("Job created.")).toBeNull();
  });

  // ── Edit form ────────────────────────────────────────────────────────────

  it("hides the Edit button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [createJobRow({ name: "Farming" })],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Farming");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("opens the edit form when Edit is clicked", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [createJobRow({ name: "Farming" })],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Farming");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      await screen.findByRole("heading", { name: "Edit job" }),
    ).toBeDefined();
  });

  it("emits a success toast after saving an edited job", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({ job_type: "standard", name: "Farming" });
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [jobRow],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Farming");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });
    const nameInput = screen.getByRole("textbox", { name: "Name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Farming");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("adds an input row in the edit form", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({ job_type: "standard", name: "Farming" });
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [jobRow],
        resourceRows: [createResourceRow({ name: "Grain" })],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Farming");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });

    expect(screen.queryByText("Inputs entry 1 resource")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add input" }));

    expect(
      screen.getByRole("combobox", { name: "Inputs entry 1 resource" }),
    ).toBeDefined();
  });

  it("removes an output row in the edit form", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({
      job_type: "standard",
      name: "Farming",
      outputs_json: [{ amount_per_worker: 2, resource_id: RESOURCE_ID }],
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [jobRow],
        resourceRows: [createResourceRow()],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Farming");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });

    expect(
      screen.getByRole("combobox", { name: "Outputs entry 1 resource" }),
    ).toBeDefined();

    await user.click(
      screen.getByRole("button", { name: "Remove output entry 1" }),
    );

    expect(
      screen.queryByRole("combobox", { name: "Outputs entry 1 resource" }),
    ).toBeNull();
  });

  it("shows a validation error when an input row has an invalid amount", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({
      job_type: "standard",
      name: "Farming",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [jobRow],
        resourceRows: [createResourceRow({ name: "Grain" })],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Farming");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });

    await user.click(screen.getByRole("button", { name: "Add input" }));

    const amountInput = screen.getByRole("textbox", {
      name: "Inputs entry 1 amount per worker",
    });
    await user.clear(amountInput);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).not.toHaveBeenCalled();
    });
    expect(screen.queryByText("Job saved.")).toBeNull();
  });

  it("links a deposit type when editing a deposit job", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({ job_type: "deposit", name: "Iron Mining" });
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({ id: DEPOSIT_TYPE_ID, name: "Iron Ore" }),
        ],
        jobRows: [jobRow],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Iron Mining");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });

    const depositSelect = screen.getByRole("combobox", {
      name: "Linked deposit type",
    });
    await user.selectOptions(depositSelect, DEPOSIT_TYPE_ID);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("links a managed population type when editing a husbandry job", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({
      id: JOB_ID,
      job_type: "husbandry",
      name: "Sheep Herding",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [jobRow],
        managedPopulationTypeRows: [
          createManagedPopulationTypeRow({
            husbandry_job_id: JOB_ID,
            id: MANAGED_POP_TYPE_ID,
            name: "Sheep",
          }),
        ],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Sheep Herding");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });

    const popTypeSelect = screen.getByRole("combobox", {
      name: "Linked managed population type",
    });
    await user.selectOptions(popTypeSelect, MANAGED_POP_TYPE_ID);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("links a managed population type when editing a culling job", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({
      id: JOB_ID,
      job_type: "culling",
      name: "Wolf Culling",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [jobRow],
        managedPopulationTypeRows: [
          createManagedPopulationTypeRow({
            culling_job_id: JOB_ID,
            id: MANAGED_POP_TYPE_ID,
            name: "Wolf",
          }),
        ],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Wolf Culling");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });

    const popTypeSelect = screen.getByRole("combobox", {
      name: "Linked managed population type",
    });
    await user.selectOptions(popTypeSelect, MANAGED_POP_TYPE_ID);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("does not show IO editors when editing a construction job", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({
      job_type: "construction",
      name: "Build Wall",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [jobRow],
        resourceRows: [createResourceRow()],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Build Wall");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });

    expect(screen.queryByText("Inputs")).toBeNull();
    expect(screen.queryByText("Outputs")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add input" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add output" })).toBeNull();
  });

  it("saves a construction job without IO fields", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({
      job_type: "construction",
      name: "Build Wall",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [jobRow],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Build Wall");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("does not show IO badges for a construction job in the row summary", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [
          createJobRow({
            job_type: "construction",
            name: "Build Wall",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Build Wall");
    const listItem = screen.getByRole("listitem");
    expect(within(listItem).queryByText("Inputs")).toBeNull();
    expect(within(listItem).queryByText("Outputs")).toBeNull();
  });

  it("shows IO editors when editing a standard job", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({ job_type: "standard", name: "Farming" });
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [jobRow],
        resourceRows: [createResourceRow({ name: "Grain" })],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Farming");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });

    expect(screen.getByRole("button", { name: "Add input" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add output" })).toBeDefined();
  });

  it("moves a job to trash via the inline row button", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [createJobRow({ name: "Farming" })],
        rpcResult: {
          data: { id: JOB_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Farming");
    await user.click(
      screen.getByRole("button", { name: "Move Farming to trash" }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Job moved to trash.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("hides the inline trash button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [createJobRow({ name: "Farming" })],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Farming");
    expect(
      screen.queryByRole("button", { name: "Move Farming to trash" }),
    ).toBeNull();
  });

  it("shows inline error for a deleted resource in IO entries", async () => {
    const user = userEvent.setup();
    const jobRow = createJobRow({
      inputs_json: [
        {
          amount_per_worker: 1,
          resource_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
        },
      ],
      job_type: "standard",
      name: "Farming",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        // No resources returned — simulates deleted resource
        jobRows: [jobRow],
        resourceRows: [],
        updateResult: { data: jobRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Farming");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit job" });

    expect(
      screen.getByText(
        "This resource has been deleted. Remove this row or select a different resource.",
      ),
    ).toBeDefined();
  });
});

function renderPanel({
  canAdmin,
  isArchived,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <WorldJobsConfigPanel
        canAdmin={canAdmin}
        isArchived={isArchived}
        worldId={WORLD_ID}
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

type TestJobRow = {
  readonly base_capacity: number | null;
  readonly created_at: string;
  readonly culling_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly deposit_types: ReadonlyArray<{ readonly id: string }>;
  readonly husbandry_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly id: string;
  readonly inputs_json: readonly {
    amount_per_worker: number;
    resource_id: string;
  }[];
  readonly is_active: boolean;
  readonly job_type: string;
  readonly linked_deposit_type_id: string | null;
  readonly linked_managed_population_type_id: string | null;
  readonly name: string;
  readonly outputs_json: readonly {
    amount_per_worker: number;
    resource_id: string;
  }[];
  readonly slug: string;
  readonly trader_capacity_per_worker: number | null;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestDepositTypeRow = {
  readonly created_at: string;
  readonly id: string;
  readonly is_active: boolean;
  readonly job_id: string;
  readonly name: string;
  readonly output_units_per_worker: number;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly slug: string;
  readonly updated_at: string;
  readonly worker_inputs_json: readonly unknown[];
  readonly world_id: string;
};

type TestManagedPopulationTypeRow = {
  readonly created_at: string;
  readonly culling_job_id: string;
  readonly culling_outputs_json: readonly unknown[];
  readonly growth_rate: number;
  readonly husbandry_job_id: string;
  readonly husbandry_workers_per_n_animals: number;
  readonly id: string;
  readonly is_active: boolean;
  readonly maintenance_rules_json: readonly unknown[];
  readonly name: string;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestResourceRow = {
  readonly base_stockpile_cap: number;
  readonly created_at: string;
  readonly id: string;
  readonly is_deleted: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: null;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createJobRow(overrides: Partial<TestJobRow> = {}): TestJobRow {
  return {
    base_capacity: null,
    created_at: "2026-01-01T00:00:00.000Z",
    culling_mpt: [],
    deposit_types: [],
    husbandry_mpt: [],
    id: JOB_ID,
    inputs_json: [],
    is_active: true,
    job_type: "standard",
    linked_deposit_type_id: null,
    linked_managed_population_type_id: null,
    name: "Test Job",
    outputs_json: [],
    slug: "test-job",
    trader_capacity_per_worker: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createDepositTypeRow(
  overrides: Partial<TestDepositTypeRow> = {},
): TestDepositTypeRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    id: DEPOSIT_TYPE_ID,
    is_active: true,
    job_id: JOB_ID,
    name: "Test Deposit Type",
    output_units_per_worker: 1,
    referencing_jobs: [],
    slug: "test-deposit-type",
    updated_at: "2026-01-01T00:00:00.000Z",
    worker_inputs_json: [],
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createManagedPopulationTypeRow(
  overrides: Partial<TestManagedPopulationTypeRow> = {},
): TestManagedPopulationTypeRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    culling_job_id: CULLING_JOB_ID,
    culling_outputs_json: [],
    growth_rate: 0.05,
    husbandry_job_id: JOB_ID,
    husbandry_workers_per_n_animals: 10,
    id: MANAGED_POP_TYPE_ID,
    is_active: true,
    maintenance_rules_json: [],
    name: "Test Population",
    referencing_jobs: [],
    slug: "test-population",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createResourceRow(
  overrides: Partial<TestResourceRow> = {},
): TestResourceRow {
  return {
    base_stockpile_cap: 1000,
    created_at: "2026-01-01T00:00:00.000Z",
    id: RESOURCE_ID,
    is_deleted: false,
    is_system_resource: false,
    last_cleanup_summary_json: null,
    name: "Iron",
    slug: "iron",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createClient({
  depositTypeRows = [],
  insertResult = { data: createJobRow(), error: null },
  jobRows,
  managedPopulationTypeRows = [],
  resourceRows = [],
  rpcResult = { data: null, error: null },
  updateResult = { data: createJobRow(), error: null },
}: {
  readonly depositTypeRows?: readonly TestDepositTypeRow[];
  readonly insertResult?: {
    readonly data: TestJobRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly jobRows: readonly TestJobRow[];
  readonly managedPopulationTypeRows?: readonly TestManagedPopulationTypeRow[];
  readonly resourceRows?: readonly TestResourceRow[];
  readonly rpcResult?: {
    readonly data: { readonly id: string; readonly world_id: string } | null;
    readonly error: { readonly message: string } | null;
  };
  readonly updateResult?: {
    readonly data: TestJobRow | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "job_definitions") {
        return createJobsQueryBuilder(jobRows, insertResult, updateResult);
      }
      if (table === "resources") {
        return createSimpleQueryBuilder(resourceRows);
      }
      if (table === "deposit_types") {
        return createSimpleQueryBuilder(depositTypeRows);
      }
      if (table === "managed_population_types") {
        return createSimpleQueryBuilder(managedPopulationTypeRows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(rpcResult),
    })),
  };
}

function createJobsQueryBuilder(
  rows: readonly TestJobRow[],
  insertResult: {
    readonly data: TestJobRow | null;
    readonly error: { readonly message: string } | null;
  },
  updateResult: {
    readonly data: TestJobRow | null;
    readonly error: { readonly message: string } | null;
  },
): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  const updateBuilder: Record<string, unknown> = {
    eq: vi.fn(() => updateBuilder),
    select: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(updateResult),
    })),
  };

  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(insertResult),
      })),
    })),
    select: vi.fn(() => selectBuilder),
    update: vi.fn(() => updateBuilder),
  };
}

function createSimpleQueryBuilder(rows: readonly unknown[]): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return {
    select: vi.fn(() => selectBuilder),
  };
}
