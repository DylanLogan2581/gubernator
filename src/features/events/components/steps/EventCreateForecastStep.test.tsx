import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventCreateForecastStep } from "./EventCreateForecastStep";

import type { EventMemoryDraft } from "./EventCreateForecastStep";

type MockQueryData = {
  settlements: Array<{ id: string; name: string; nationName: string }>;
  nations: Array<{ id: string; name: string }>;
  resources: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; name: string }>;
  buildingsBySettlement: Record<
    string,
    Array<{ id: string; blueprintName: string }>
  >;
};

const { queryData } = vi.hoisted((): { queryData: MockQueryData } => ({
  queryData: {
    settlements: [],
    nations: [],
    resources: [],
    jobs: [],
    buildingsBySettlement: {},
  },
}));

vi.mock("@/features/settlements", () => ({
  settlementsByWorldQueryOptions: () => ({
    queryKey: ["settlements-test"],
    queryFn: () => Promise.resolve(queryData.settlements),
  }),
}));

vi.mock("@/features/nations", () => ({
  nationsListQueryOptions: () => ({
    queryKey: ["nations-test"],
    queryFn: () => Promise.resolve(queryData.nations),
  }),
}));

vi.mock("@/features/resources", () => ({
  activeResourcesByWorldQueryOptions: () => ({
    queryKey: ["resources-test"],
    queryFn: () => Promise.resolve(queryData.resources),
  }),
}));

vi.mock("@/features/jobs", () => ({
  activeJobsByWorldQueryOptions: () => ({
    queryKey: ["jobs-test"],
    queryFn: () => Promise.resolve(queryData.jobs),
  }),
}));

vi.mock("@/features/calendar", () => ({
  worldCalendarConfigQueryOptions: () => ({
    queryKey: ["calendar-config-test"],
    queryFn: () => Promise.resolve(null),
  }),
}));

vi.mock("@/features/buildings", () => ({
  settlementBuildingsBySettlementQueryOptions: (settlementId: string) => ({
    queryKey: ["buildings-settlement-test", settlementId],
    queryFn: () =>
      Promise.resolve(queryData.buildingsBySettlement[settlementId] ?? []),
  }),
  settlementBuildingsByNationsQueryOptions: () => ({
    queryKey: ["buildings-nation-test"],
    queryFn: () => Promise.resolve([]),
  }),
  settlementBuildingsByWorldQueryOptions: () => ({
    queryKey: ["buildings-world-test"],
    queryFn: () => Promise.resolve([]),
  }),
}));

vi.mock("@/features/deposits", () => ({
  depositTypesByWorldQueryOptions: () => ({
    queryKey: ["deposit-types-test"],
    queryFn: () => Promise.resolve([]),
  }),
  depositInstancesBySettlementQueryOptions: () => ({
    queryKey: ["deposits-settlement-test"],
    queryFn: () => Promise.resolve([]),
  }),
  depositInstancesByNationsQueryOptions: () => ({
    queryKey: ["deposits-nation-test"],
    queryFn: () => Promise.resolve([]),
  }),
  depositInstancesByWorldQueryOptions: () => ({
    queryKey: ["deposits-world-test"],
    queryFn: () => Promise.resolve([]),
  }),
}));

type EventCreateForecastStepEffects = Parameters<
  typeof EventCreateForecastStep
>[0]["effects"];

function renderForecastStep(
  effects: EventCreateForecastStepEffects,
  opts: {
    scopeType?: "world" | "nation" | "settlement";
    selectedIds?: string[];
    durationType?: "instant" | "sustained";
    durationTransitions?: number | null;
    memories?: EventMemoryDraft[];
    onMemoriesChange?: (memories: readonly EventMemoryDraft[]) => void;
  } = {},
): { onMemoriesChange: ReturnType<typeof vi.fn> } {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const onMemoriesChange = vi.fn(opts.onMemoriesChange);

  render(
    <QueryClientProvider client={queryClient}>
      <EventCreateForecastStep
        groupName="Test Event"
        groupDescription=""
        scopeType={opts.scopeType ?? "settlement"}
        selectedIds={opts.selectedIds ?? []}
        effects={effects}
        durationType={opts.durationType ?? "instant"}
        durationTransitions={opts.durationTransitions ?? null}
        activationTurn={1}
        worldId="world-1"
        memories={opts.memories ?? []}
        onMemoriesChange={onMemoriesChange}
      />
    </QueryClientProvider>,
  );

  return { onMemoriesChange };
}

describe("EventCreateForecastStep — upkeep_multiplier specific buildings", () => {
  beforeEach(() => {
    queryData.settlements = [];
    queryData.nations = [];
    queryData.resources = [];
    queryData.jobs = [];
    queryData.buildingsBySettlement = {};
  });

  it("shows building names (not UUIDs) and a buildings-count impact for instance mode", async () => {
    queryData.settlements = [
      { id: "settlement-1", name: "Riverton", nationName: "Nation A" },
    ];
    queryData.buildingsBySettlement = {
      "settlement-1": [
        { id: "building-1", blueprintName: "Farm" },
        { id: "building-2", blueprintName: "Mill" },
      ],
    };

    renderForecastStep(
      [
        {
          effectType: "upkeep_multiplier",
          isPercent: false,
          amountValue: null,
          multiplierValue: 1.5,
          resourceId: null,
          jobId: null,
          managedPopulationInstanceId: null,
          depositInstanceId: null,
          buildingBlueprintMode: "instance",
          buildingInstanceIds: ["building-1", "building-2"],
        },
      ],
      { scopeType: "settlement", selectedIds: ["settlement-1"] },
    );

    expect(
      await screen.findByText(/Farm \(Riverton\), Mill \(Riverton\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("2 buildings")).toBeInTheDocument();
    expect(screen.queryByText(/building-1/)).not.toBeInTheDocument();
  });
});

describe("EventCreateForecastStep — forecast timeline", () => {
  beforeEach(() => {
    queryData.settlements = [];
    queryData.nations = [];
    queryData.resources = [];
    queryData.jobs = [];
    queryData.buildingsBySettlement = {};
  });

  it("shows a one-time destroy on turn 1 and a repeating rate on every turn of a sustained event", async () => {
    queryData.settlements = [
      { id: "settlement-1", name: "Riverton", nationName: "Nation A" },
    ];

    renderForecastStep(
      [
        {
          effectType: "deposit_destroyed",
          isPercent: false,
          amountValue: null,
          multiplierValue: null,
          resourceId: null,
          jobId: null,
          managedPopulationInstanceId: null,
          depositInstanceId: null,
          depositInstanceIds: ["deposit-1", "deposit-2"],
        },
        {
          effectType: "population_loss",
          isPercent: true,
          amountValue: 10,
          multiplierValue: null,
          resourceId: null,
          jobId: null,
          managedPopulationInstanceId: null,
          depositInstanceId: null,
        },
      ],
      {
        scopeType: "world",
        durationType: "sustained",
        durationTransitions: 2,
      },
    );

    expect(await screen.findByText("Turn 2")).toBeInTheDocument();
    expect(screen.getByText("Turn 3")).toBeInTheDocument();
    expect(screen.getByText(/2 deposit destroyed/)).toBeInTheDocument();
    expect(screen.getAllByText(/10% each turn/).length).toBe(2);
  });

  it("adds, edits, and removes a per-turn memory", async () => {
    const user = userEvent.setup();
    const { onMemoriesChange } = renderForecastStep([]);

    await user.click(screen.getByRole("button", { name: /add memory/i }));
    expect(onMemoriesChange).toHaveBeenCalledWith([
      { turnOffset: 0, text: "" },
    ]);
  });
});
