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
    expect(within(listItem).getByText("farming")).toBeDefined();
  });

  it("shows archived jobs and badge when toggle is active", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        jobRows: [
          createJobRow({ is_active: true, name: "Active Job" }),
          createJobRow({
            id: "00000000-0000-0000-0000-000000000003",
            is_active: false,
            name: "Archived Job",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Active Job");
    expect(screen.queryByText("Archived Job")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show archived" }));

    expect(screen.getByText("Archived Job")).toBeDefined();
    expect(screen.getByText("archived")).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide archived" })).toBeDefined();
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
      screen.getByText("Create a deposit type first to link to this job."),
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
        "Create a managed population type first to link to this job.",
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
        "Create a managed population type first to link to this job.",
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
  readonly id: string;
  readonly inputs_json: readonly unknown[];
  readonly is_active: boolean;
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

function createJobRow(overrides: Partial<TestJobRow> = {}): TestJobRow {
  return {
    base_capacity: null,
    created_at: "2026-01-01T00:00:00.000Z",
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

function createClient({
  insertResult = { data: createJobRow(), error: null },
  jobRows,
}: {
  readonly insertResult?: {
    readonly data: TestJobRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly jobRows: readonly TestJobRow[];
}): {
  readonly from: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "job_definitions") {
        return createJobsQueryBuilder(jobRows, insertResult);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createJobsQueryBuilder(
  rows: readonly TestJobRow[],
  insertResult: {
    readonly data: TestJobRow | null;
    readonly error: { readonly message: string } | null;
  },
): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(insertResult),
      })),
    })),
    select: vi.fn(() => selectBuilder),
  };
}
