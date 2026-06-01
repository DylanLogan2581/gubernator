import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManagedPopulationsConfigPanel } from "./ManagedPopulationsConfigPanel";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <a className={className}>{children}</a>,
}));

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
const POPULATION_TYPE_ID = "00000000-0000-0000-0000-000000000002";
const HUSBANDRY_JOB_ID = "00000000-0000-0000-0000-000000000003";
const CULLING_JOB_ID = "00000000-0000-0000-0000-000000000004";
const HUSBANDRY_JOB_ID_2 = "00000000-0000-0000-0000-000000000005";
const CULLING_JOB_ID_2 = "00000000-0000-0000-0000-000000000006";

describe("ManagedPopulationsConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows empty state when there are no managed population types", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [],
        cullingJobRows: [],
        populationTypeRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    expect(
      await screen.findByText("No managed population types yet"),
    ).toBeDefined();
  });

  it("hides the Add population type button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [],
        cullingJobRows: [],
        populationTypeRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No managed population types yet");
    expect(
      screen.queryByRole("button", { name: "Add population type" }),
    ).toBeNull();
  });

  it("shows population types with name, growth rate, and workers per N", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [],
        cullingJobRows: [],
        populationTypeRows: [
          createPopulationTypeRow({
            name: "Cattle",
            growth_rate: 0.05,
            husbandry_workers_per_n_animals: 2,
          }),
        ],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Cattle");
    expect(screen.getByText(/5\.0% growth/)).toBeDefined();
    expect(screen.getByText(/2 workers\/N/)).toBeDefined();
  });

  it("shows linked husbandry and culling job names in the row", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: CULLING_JOB_ID,
            name: "Cattle Culling",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [
          createPopulationTypeRow({
            husbandry_job_id: HUSBANDRY_JOB_ID,
            culling_job_id: CULLING_JOB_ID,
            name: "Cattle",
          }),
        ],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Cattle");
    expect(await screen.findByText(/Cattle Husbandry/)).toBeDefined();
    expect(await screen.findByText(/Cattle Culling/)).toBeDefined();
  });

  it("shows empty state with create link when no husbandry or culling jobs exist in create form", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [],
        cullingJobRows: [],
        populationTypeRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Managed Population Types" });
    await user.click(
      screen.getByRole("button", { name: "Add population type" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Create managed population type",
    });
    expect(within(dialog).getByText("No husbandry jobs yet")).toBeDefined();
    expect(within(dialog).getByText("Create husbandry job")).toBeDefined();
    expect(within(dialog).getByText("No culling jobs yet")).toBeDefined();
    expect(within(dialog).getByText("Create culling job")).toBeDefined();
    expect(
      within(dialog).queryByRole("combobox", { name: "Husbandry job" }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole("combobox", { name: "Culling job" }),
    ).toBeNull();
  });

  it("shows trashed population types when trash view is toggled", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [],
        cullingJobRows: [],
        populationTypeRows: [
          createPopulationTypeRow({ is_trashed: false, name: "Active Cattle" }),
          createPopulationTypeRow({
            id: "00000000-0000-0000-0000-000000000010",
            is_trashed: true,
            name: "Trashed Cattle",
          }),
        ],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Active Cattle");
    expect(screen.queryByText("Trashed Cattle")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show trash" }));

    expect(screen.getByText("Trashed Cattle")).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide trash" })).toBeDefined();
  });

  it("emits a success toast after creating a managed population type", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: CULLING_JOB_ID,
            name: "Cattle Culling",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [],
        resourceRows: [],
        insertResult: {
          data: createPopulationTypeRow({ name: "Cattle" }),
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Managed Population Types" });
    await user.click(
      screen.getByRole("button", { name: "Add population type" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Create managed population type",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Cattle",
    );

    expect(within(dialog).getByText("slug: cattle")).toBeDefined();

    const husbandrySelect = within(dialog).getByRole("combobox", {
      name: "Husbandry job",
    });
    await user.selectOptions(husbandrySelect, HUSBANDRY_JOB_ID);

    const cullingSelect = within(dialog).getByRole("combobox", {
      name: "Culling job",
    });
    await user.selectOptions(cullingSelect, CULLING_JOB_ID);

    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Managed population type created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits a success toast after editing a managed population type", async () => {
    const user = userEvent.setup();
    const populationTypeRow = createPopulationTypeRow({
      husbandry_job_id: HUSBANDRY_JOB_ID,
      culling_job_id: CULLING_JOB_ID,
      name: "Cattle",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: CULLING_JOB_ID,
            name: "Cattle Culling",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [populationTypeRow],
        resourceRows: [],
        updateResult: {
          data: populationTypeRow,
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Cattle");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", {
      name: "Edit managed population type",
    });
    const nameInput = screen.getByRole("textbox", { name: "Name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Beef Cattle");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Managed population type saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows inline error when selected husbandry job is already linked to another type", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
          createJobRow({
            id: HUSBANDRY_JOB_ID_2,
            name: "Sheep Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: CULLING_JOB_ID,
            name: "Cattle Culling",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [
          createPopulationTypeRow({
            husbandry_job_id: HUSBANDRY_JOB_ID,
            culling_job_id: CULLING_JOB_ID,
            name: "Cattle",
          }),
        ],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Managed Population Types" });
    await user.click(
      screen.getByRole("button", { name: "Add population type" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Create managed population type",
    });
    const husbandrySelect = within(dialog).getByRole("combobox", {
      name: "Husbandry job",
    });
    await user.selectOptions(husbandrySelect, HUSBANDRY_JOB_ID);

    expect(
      within(dialog).getByText('This job is already linked to "Cattle".'),
    ).toBeDefined();

    expect(
      within(dialog).getByRole("button", { name: "Create" }),
    ).toBeDisabled();
  });

  it("shows inline error when selected culling job is already linked to another type", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: CULLING_JOB_ID,
            name: "Cattle Culling",
            job_type: "culling",
          }),
          createJobRow({
            id: CULLING_JOB_ID_2,
            name: "Sheep Culling",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [
          createPopulationTypeRow({
            husbandry_job_id: HUSBANDRY_JOB_ID,
            culling_job_id: CULLING_JOB_ID,
            name: "Cattle",
          }),
        ],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Managed Population Types" });
    await user.click(
      screen.getByRole("button", { name: "Add population type" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Create managed population type",
    });
    const cullingSelect = within(dialog).getByRole("combobox", {
      name: "Culling job",
    });
    await user.selectOptions(cullingSelect, CULLING_JOB_ID);

    expect(
      within(dialog).getByText('This job is already linked to "Cattle".'),
    ).toBeDefined();

    expect(
      within(dialog).getByRole("button", { name: "Create" }),
    ).toBeDisabled();
  });

  it("shows inline error when husbandry and culling jobs are the same", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Managed Population Types" });
    await user.click(
      screen.getByRole("button", { name: "Add population type" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Create managed population type",
    });

    const husbandrySelect = within(dialog).getByRole("combobox", {
      name: "Husbandry job",
    });
    await user.selectOptions(husbandrySelect, HUSBANDRY_JOB_ID);

    const cullingSelect = within(dialog).getByRole("combobox", {
      name: "Culling job",
    });
    await user.selectOptions(cullingSelect, HUSBANDRY_JOB_ID);

    expect(
      within(dialog).getAllByText(
        "Husbandry job and culling job must be different.",
      ),
    ).toHaveLength(2);

    expect(
      within(dialog).getByRole("button", { name: "Create" }),
    ).toBeDisabled();
  });

  it("shows inline error in edit form when husbandry job is already linked to a different type", async () => {
    const user = userEvent.setup();
    const populationTypeRow = createPopulationTypeRow({
      husbandry_job_id: HUSBANDRY_JOB_ID,
      culling_job_id: CULLING_JOB_ID,
      name: "Cattle",
    });
    const otherPopulationTypeRow = createPopulationTypeRow({
      id: "00000000-0000-0000-0000-000000000020",
      husbandry_job_id: HUSBANDRY_JOB_ID_2,
      culling_job_id: CULLING_JOB_ID_2,
      name: "Sheep",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
          createJobRow({
            id: HUSBANDRY_JOB_ID_2,
            name: "Sheep Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: CULLING_JOB_ID,
            name: "Cattle Culling",
            job_type: "culling",
          }),
          createJobRow({
            id: CULLING_JOB_ID_2,
            name: "Sheep Culling",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [populationTypeRow, otherPopulationTypeRow],
        resourceRows: [],
        updateResult: { data: populationTypeRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Cattle");
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    await screen.findByRole("heading", {
      name: "Edit managed population type",
    });
    const husbandrySelect = screen.getByRole("combobox", {
      name: "Husbandry job",
    });
    await user.selectOptions(husbandrySelect, HUSBANDRY_JOB_ID_2);

    expect(
      screen.getByText('This job is already linked to "Sheep".'),
    ).toBeDefined();

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("hides the Edit button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [],
        cullingJobRows: [],
        populationTypeRows: [createPopulationTypeRow({ name: "Cattle" })],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Cattle");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("moves a managed population type to trash via the inline row button", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [],
        cullingJobRows: [],
        populationTypeRows: [createPopulationTypeRow({ name: "Cattle" })],
        resourceRows: [],
        rpcResult: {
          data: { id: POPULATION_TYPE_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Cattle");
    await user.click(
      screen.getByRole("button", { name: "Move Cattle to trash" }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Managed population type moved to trash.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("hides the inline trash button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [],
        cullingJobRows: [],
        populationTypeRows: [createPopulationTypeRow({ name: "Cattle" })],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Cattle");
    expect(
      screen.queryByRole("button", { name: "Move Cattle to trash" }),
    ).toBeNull();
  });

  it("create form shows growth rate as a whole-percent input defaulting to 0", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: CULLING_JOB_ID,
            name: "Cattle Culling",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Managed Population Types" });
    await user.click(
      screen.getByRole("button", { name: "Add population type" }),
    );

    const growthRateInput = await screen.findByRole("spinbutton", {
      name: "Growth rate",
    });
    expect(growthRateInput).toHaveValue(0);
  });

  it("create form submits a 0–1 decimal when the user enters a whole percent", async () => {
    const user = userEvent.setup();
    const populationTypeRow = createPopulationTypeRow({ name: "Cattle" });
    const insertMock = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: populationTypeRow, error: null }),
      })),
    }));
    requireSupabaseClient.mockReturnValue(
      createClientWithInsertSpy({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: CULLING_JOB_ID,
            name: "Cattle Culling",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [],
        resourceRows: [],
        insertMock,
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Managed Population Types" });
    await user.click(
      screen.getByRole("button", { name: "Add population type" }),
    );

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Cattle");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Husbandry job" }),
      HUSBANDRY_JOB_ID,
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Culling job" }),
      CULLING_JOB_ID,
    );

    const growthRateInput = screen.getByRole("spinbutton", {
      name: "Growth rate",
    });
    await user.clear(growthRateInput);
    await user.type(growthRateInput, "5");

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    const calls = insertMock.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    expect(calls[0]?.[0]?.growth_rate).toBeCloseTo(0.05);
  });

  it("edit form displays growth_rate 0.05 as 5 in the percent input", async () => {
    const user = userEvent.setup();
    const populationTypeRow = createPopulationTypeRow({
      husbandry_job_id: HUSBANDRY_JOB_ID,
      culling_job_id: CULLING_JOB_ID,
      name: "Cattle",
      growth_rate: 0.05,
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: CULLING_JOB_ID,
            name: "Cattle Culling",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [populationTypeRow],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Cattle");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", {
      name: "Edit managed population type",
    });

    expect(screen.getByRole("spinbutton", { name: "Growth rate" })).toHaveValue(
      5,
    );
  });

  it("edit form submits a 0–1 decimal when the user enters a whole percent", async () => {
    const user = userEvent.setup();
    const populationTypeRow = createPopulationTypeRow({
      husbandry_job_id: HUSBANDRY_JOB_ID,
      culling_job_id: CULLING_JOB_ID,
      name: "Cattle",
      growth_rate: 0.05,
    });
    const updateBuilder: Record<string, unknown> = {
      eq: vi.fn(() => updateBuilder),
      select: vi.fn(() => ({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: populationTypeRow, error: null }),
      })),
    };
    const updateMock = vi.fn(() => updateBuilder);
    requireSupabaseClient.mockReturnValue(
      createClientWithUpdateSpy({
        husbandryJobRows: [
          createJobRow({
            id: HUSBANDRY_JOB_ID,
            name: "Cattle Husbandry",
            job_type: "husbandry",
          }),
        ],
        cullingJobRows: [
          createJobRow({
            id: CULLING_JOB_ID,
            name: "Cattle Culling",
            job_type: "culling",
          }),
        ],
        populationTypeRows: [populationTypeRow],
        resourceRows: [],
        updateMock,
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Cattle");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", {
      name: "Edit managed population type",
    });

    const growthRateInput = screen.getByRole("spinbutton", {
      name: "Growth rate",
    });
    await user.clear(growthRateInput);
    await user.type(growthRateInput, "10");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });

    const updateCalls = updateMock.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    expect(updateCalls[0]?.[0]?.growth_rate).toBeCloseTo(0.1);
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
      <ManagedPopulationsConfigPanel
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

type TestPopulationTypeRow = {
  readonly created_at: string;
  readonly culling_job_id: string;
  readonly culling_outputs_json: readonly unknown[];
  readonly growth_rate: number;
  readonly husbandry_job_id: string;
  readonly husbandry_workers_per_n_animals: number;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly maintenance_rules_json: readonly unknown[];
  readonly name: string;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestJobRow = {
  readonly base_capacity: number | null;
  readonly created_at: string;
  readonly culling_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly deposit_types: ReadonlyArray<{ readonly id: string }>;
  readonly husbandry_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly id: string;
  readonly inputs_json: readonly unknown[];
  readonly is_trashed: boolean;
  readonly job_type: string;
  readonly linked_deposit_type_id: string | null;
  readonly linked_managed_population_type_id: string | null;
  readonly name: string;
  readonly outputs_json: readonly unknown[];
  readonly slug: string;
  readonly trader_capacity_per_worker: number | null;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestResourceRow = {
  readonly base_stockpile_cap: number;
  readonly created_at: string;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: null;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createPopulationTypeRow(
  overrides: Partial<TestPopulationTypeRow> = {},
): TestPopulationTypeRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    culling_job_id: CULLING_JOB_ID,
    culling_outputs_json: [],
    growth_rate: 0.05,
    husbandry_job_id: HUSBANDRY_JOB_ID,
    husbandry_workers_per_n_animals: 2,
    id: POPULATION_TYPE_ID,
    is_trashed: false,
    maintenance_rules_json: [],
    name: "Test Population",
    referencing_jobs: [],
    slug: "test-population",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createJobRow(overrides: Partial<TestJobRow> = {}): TestJobRow {
  return {
    base_capacity: null,
    created_at: "2026-01-01T00:00:00.000Z",
    culling_mpt: [],
    deposit_types: [],
    husbandry_mpt: [],
    id: HUSBANDRY_JOB_ID,
    inputs_json: [],
    is_trashed: false,
    job_type: "husbandry",
    linked_deposit_type_id: null,
    linked_managed_population_type_id: null,
    name: "Test Husbandry Job",
    outputs_json: [],
    slug: "test-husbandry-job",
    trader_capacity_per_worker: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createClient({
  husbandryJobRows,
  cullingJobRows,
  populationTypeRows,
  resourceRows,
  insertResult = { data: createPopulationTypeRow(), error: null },
  rpcResult = { data: null, error: null },
  updateResult = { data: createPopulationTypeRow(), error: null },
}: {
  readonly cullingJobRows: readonly TestJobRow[];
  readonly husbandryJobRows: readonly TestJobRow[];
  readonly insertResult?: {
    readonly data: TestPopulationTypeRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly populationTypeRows: readonly TestPopulationTypeRow[];
  readonly resourceRows: readonly TestResourceRow[];
  readonly rpcResult?: {
    readonly data: { readonly id: string; readonly world_id: string } | null;
    readonly error: { readonly message: string } | null;
  };
  readonly updateResult?: {
    readonly data: TestPopulationTypeRow | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "managed_population_types") {
        return createPopulationTypesQueryBuilder(
          populationTypeRows,
          insertResult,
          updateResult,
        );
      }
      if (table === "job_definitions") {
        return createJobsQueryBuilder(husbandryJobRows, cullingJobRows);
      }
      if (table === "resources") {
        return createResourcesQueryBuilder(resourceRows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(rpcResult),
    })),
  };
}

function createPopulationTypesQueryBuilder(
  rows: readonly TestPopulationTypeRow[],
  insertResult: {
    readonly data: TestPopulationTypeRow | null;
    readonly error: { readonly message: string } | null;
  },
  updateResult: {
    readonly data: TestPopulationTypeRow | null;
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

function createJobsQueryBuilder(
  husbandryRows: readonly TestJobRow[],
  cullingRows: readonly TestJobRow[],
): unknown {
  let jobType: string | null = null;

  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn((column: string, value: string) => {
      if (column === "job_type") {
        jobType = value;
      }
      return selectBuilder;
    }),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn(() => {
      const rows = jobType === "culling" ? cullingRows : husbandryRows;
      return Promise.resolve({ data: rows, error: null });
    }),
  };

  return {
    select: vi.fn(() => selectBuilder),
  };
}

function createResourcesQueryBuilder(
  rows: readonly TestResourceRow[],
): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return {
    select: vi.fn(() => selectBuilder),
  };
}

function createClientWithInsertSpy({
  husbandryJobRows,
  cullingJobRows,
  populationTypeRows,
  resourceRows,
  insertMock,
}: {
  readonly cullingJobRows: readonly TestJobRow[];
  readonly husbandryJobRows: readonly TestJobRow[];
  readonly insertMock: ReturnType<typeof vi.fn>;
  readonly populationTypeRows: readonly TestPopulationTypeRow[];
  readonly resourceRows: readonly TestResourceRow[];
}): { readonly from: ReturnType<typeof vi.fn> } {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi
      .fn()
      .mockResolvedValue({ data: populationTypeRows, error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "managed_population_types") {
        return {
          insert: insertMock,
          select: vi.fn(() => selectBuilder),
          update: vi.fn(() => {
            const updateBuilder: Record<string, unknown> = {
              eq: vi.fn(() => updateBuilder),
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: createPopulationTypeRow(),
                  error: null,
                }),
              })),
            };
            return updateBuilder;
          }),
        };
      }
      if (table === "job_definitions") {
        return createJobsQueryBuilder(husbandryJobRows, cullingJobRows);
      }
      if (table === "resources") {
        return createResourcesQueryBuilder(resourceRows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createClientWithUpdateSpy({
  husbandryJobRows,
  cullingJobRows,
  populationTypeRows,
  resourceRows,
  updateMock,
}: {
  readonly cullingJobRows: readonly TestJobRow[];
  readonly husbandryJobRows: readonly TestJobRow[];
  readonly populationTypeRows: readonly TestPopulationTypeRow[];
  readonly resourceRows: readonly TestResourceRow[];
  readonly updateMock: ReturnType<typeof vi.fn>;
}): { readonly from: ReturnType<typeof vi.fn> } {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi
      .fn()
      .mockResolvedValue({ data: populationTypeRows, error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "managed_population_types") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: createPopulationTypeRow(),
                error: null,
              }),
            })),
          })),
          select: vi.fn(() => selectBuilder),
          update: updateMock,
        };
      }
      if (table === "job_definitions") {
        return createJobsQueryBuilder(husbandryJobRows, cullingJobRows);
      }
      if (table === "resources") {
        return createResourcesQueryBuilder(resourceRows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}
