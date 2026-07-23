import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventsList } from "./EventsList";

import type { EventsSearchParams, EventWithGroup } from "../types/eventTypes";

// jsdom lacks pointer capture / scrollIntoView, which Radix Select needs to open.
/* eslint-disable @typescript-eslint/unbound-method */
Element.prototype.hasPointerCapture ??= function hasPointerCapture() {
  return false;
};
Element.prototype.setPointerCapture ??= function setPointerCapture() {};
Element.prototype.releasePointerCapture ??= function releasePointerCapture() {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
/* eslint-enable @typescript-eslint/unbound-method */

const { navigateMock, requireSupabaseClient } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("./EventDetail", () => ({
  EventDetail: ({ eventId }: { readonly eventId: string }) => (
    <div data-testid="event-detail">{eventId}</div>
  ),
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000001";

function createEvent(overrides: Partial<EventWithGroup> = {}): EventWithGroup {
  return {
    id: "00000000-0000-0000-0000-000000000010",
    world_id: WORLD_ID,
    event_group_id: null,
    name: "Drought",
    description: null,
    status: "active",
    effect_type: "resource_modifier",
    effect_payload_jsonb: null,
    activate_on_transition_after_turn_number: 1,
    scope_type: "world",
    scope_nation_id: null,
    scope_settlement_id: null,
    duration_type: "instant",
    duration_transitions: null,
    remaining_transitions: null,
    job_id: null,
    building_blueprint_id: null,
    managed_population_type_id: null,
    amount_value: null,
    multiplier_value: null,
    extra_data_jsonb: null,
    icon: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    group: null,
    ...overrides,
  };
}

function chainableEventsQuery(resolved: {
  readonly data: readonly EventWithGroup[];
  readonly error: unknown;
}): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "order", "in", "or"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: typeof resolved) => void) =>
    resolve(resolved);
  return builder;
}

function buildClient(events: readonly EventWithGroup[]): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "events") {
        return {
          select: vi.fn(() =>
            chainableEventsQuery({ data: events, error: null }),
          ),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

const EMPTY_SEARCH: EventsSearchParams = {
  status: [],
  q: "",
  sort: "created_at",
};

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

function renderList(
  search: EventsSearchParams = EMPTY_SEARCH,
  overrides: {
    readonly canCreate?: boolean;
    readonly canManage?: boolean;
  } = {},
): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <EventsList
        worldId={WORLD_ID}
        canCreate={overrides.canCreate ?? true}
        canManage={overrides.canManage ?? true}
        onCreateClick={vi.fn()}
        search={search}
      />
    </QueryClientProvider>,
  );
}

describe("EventsList", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    navigateMock.mockReset();
  });

  afterEach(() => {
    setViewportWidth(1024);
  });

  it("renders events with status and scope badges", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient([
        createEvent({ name: "Drought", status: "active", scope_type: "world" }),
      ]),
    );

    renderList();

    await screen.findByText("Drought");
    expect(screen.getByText("Active")).toBeDefined();
    expect(screen.getByText("World")).toBeDefined();
  });

  it("shows an empty state when the world has no events", async () => {
    requireSupabaseClient.mockReturnValue(buildClient([]));

    renderList();

    expect(await screen.findByText("No events yet")).toBeDefined();
  });

  it("shows a filters-specific empty state when text search matches nothing", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient([createEvent({ name: "Drought" })]),
    );

    renderList({ status: [], q: "famine", sort: "created_at" });

    expect(
      await screen.findByText("No events match your filters"),
    ).toBeDefined();
  });

  it("shows a placeholder in the detail slot until a row is selected", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient([createEvent({ name: "Drought" })]),
    );
    const user = userEvent.setup();

    renderList();

    expect(
      await screen.findByText("Select an event to see its details"),
    ).toBeDefined();

    await user.click(await screen.findByText("Drought"));

    expect(await screen.findByTestId("event-detail")).toBeDefined();
    expect(screen.queryByText("Select an event to see its details")).toBeNull();
  });

  it("selects a row and shows the detail panel without navigating", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient([createEvent({ name: "Drought" })]),
    );
    const user = userEvent.setup();

    renderList();

    const row = await screen.findByText("Drought");
    await user.click(row);

    expect(await screen.findByTestId("event-detail")).toHaveTextContent(
      "00000000-0000-0000-0000-000000000010",
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates with an updated status filter when a status checkbox is toggled", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient([createEvent({ name: "Drought" })]),
    );
    const user = userEvent.setup();

    renderList();

    await screen.findByText("Drought");
    await user.click(screen.getByRole("button", { name: /all statuses/i }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Active" }));

    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/worlds/$worldId/events",
        params: { worldId: WORLD_ID },
      }),
    );
    const call = navigateMock.mock.calls[0]?.[0] as {
      readonly search: (prev: EventsSearchParams) => EventsSearchParams;
    };
    expect(call.search(EMPTY_SEARCH)).toEqual({
      status: ["active"],
      q: "",
      sort: "created_at",
    });
  });

  it("navigates with an updated scope filter when a scope option is selected", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient([createEvent({ name: "Drought" })]),
    );
    const user = userEvent.setup();

    renderList();

    await screen.findByText("Drought");
    await user.click(screen.getByRole("combobox", { name: "Filter by scope" }));
    await user.click(await screen.findByRole("option", { name: "Nation" }));

    const call = navigateMock.mock.calls.at(-1)?.[0] as {
      readonly search: (prev: EventsSearchParams) => EventsSearchParams;
    };
    expect(call.search(EMPTY_SEARCH)).toEqual({
      status: [],
      q: "",
      sort: "created_at",
      scope: "nation",
    });
  });

  it("navigates with an updated sort when a sort option is selected", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient([createEvent({ name: "Drought" })]),
    );
    const user = userEvent.setup();

    renderList();

    await screen.findByText("Drought");
    await user.click(screen.getByRole("combobox", { name: "Sort events" }));
    await user.click(
      await screen.findByRole("option", { name: "Sort by Status" }),
    );

    const call = navigateMock.mock.calls.at(-1)?.[0] as {
      readonly search: (prev: EventsSearchParams) => EventsSearchParams;
    };
    expect(call.search(EMPTY_SEARCH)).toEqual({
      status: [],
      q: "",
      sort: "status",
    });
  });

  it("navigates with the typed query after the debounce settles", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    requireSupabaseClient.mockReturnValue(
      buildClient([createEvent({ name: "Drought" })]),
    );
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });

    renderList();

    await screen.findByText("Drought");
    await user.type(screen.getByLabelText("Search events by name"), "famine");

    vi.advanceTimersByTime(400);
    await vi.waitFor(() => {
      expect(navigateMock).toHaveBeenCalled();
    });

    const call = navigateMock.mock.calls.at(-1)?.[0] as {
      readonly search: (prev: EventsSearchParams) => EventsSearchParams;
    };
    expect(call.search(EMPTY_SEARCH)).toEqual({
      status: [],
      q: "famine",
      sort: "created_at",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders and selects a card instead of the table on narrow viewports", async () => {
    setViewportWidth(500);
    requireSupabaseClient.mockReturnValue(
      buildClient([
        createEvent({ name: "Drought", status: "active", scope_type: "world" }),
      ]),
    );
    const user = userEvent.setup();

    renderList();

    const card = await screen.findByText("Drought");
    expect(screen.queryByRole("table")).toBeNull();

    await user.click(card);

    expect(await screen.findByTestId("event-detail")).toBeDefined();
  });

  it("hides the create button when canCreate is false", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient([createEvent({ name: "Drought" })]),
    );

    renderList(EMPTY_SEARCH, { canCreate: false });

    await screen.findByText("Drought");
    expect(screen.queryByRole("button", { name: "Create event" })).toBeNull();
  });
});
