import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventCreateStep5 } from "./EventCreateStep5";

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

function renderStep5(
  effects: EventCreateStep5Effects,
  opts: {
    scopeType?: "world" | "nation" | "settlement";
    selectedIds?: string[];
  } = {},
): void {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <EventCreateStep5
        groupName="Test Event"
        groupDescription=""
        scopeType={opts.scopeType ?? "settlement"}
        selectedIds={opts.selectedIds ?? []}
        effects={effects}
        durationType="instant"
        durationTransitions={null}
        activationTurn={1}
        createCitizenMemories={false}
        worldId="world-1"
      />
    </QueryClientProvider>,
  );
}

type EventCreateStep5Effects = Parameters<
  typeof EventCreateStep5
>[0]["effects"];

describe("EventCreateStep5 — upkeep_multiplier specific buildings", () => {
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

    renderStep5(
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
