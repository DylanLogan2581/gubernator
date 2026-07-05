import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventCreateEffectsStep } from "./EventCreateEffectsStep";

type MockQueryData = {
  resources: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; name: string }>;
  blueprints: Array<{ id: string; name: string }>;
  settlements: Array<{
    id: string;
    name: string;
    nationId: string;
    nationName: string;
  }>;
  managedPopulationTypes: Array<{ id: string; name: string }>;
  managedPopulationInstances: Record<
    string,
    Array<{ id: string; name: string; managedPopulationTypeName: string }>
  >;
  buildingsBySettlement: Record<
    string,
    Array<{ id: string; blueprintName: string }>
  >;
};

const { queryData } = vi.hoisted((): { queryData: MockQueryData } => ({
  queryData: {
    resources: [],
    jobs: [],
    blueprints: [],
    settlements: [],
    managedPopulationTypes: [],
    managedPopulationInstances: {},
    buildingsBySettlement: {},
  },
}));

vi.mock("@/features/buildings", () => ({
  blueprintsByWorldQueryOptions: () => ({
    queryKey: ["blueprints-test"],
    queryFn: () => Promise.resolve(queryData.blueprints),
  }),
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
  depositInstancesBySettlementQueryOptions: (settlementId: string) => ({
    queryKey: ["deposits-settlement-test", settlementId],
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

vi.mock("@/features/jobs", () => ({
  jobsByWorldQueryOptions: () => ({
    queryKey: ["jobs-test"],
    queryFn: () => Promise.resolve(queryData.jobs),
  }),
}));

vi.mock("@/features/managed-populations", () => ({
  managedPopulationTypesByWorldQueryOptions: () => ({
    queryKey: ["mp-types-test"],
    queryFn: () => Promise.resolve(queryData.managedPopulationTypes),
  }),
  managedPopulationInstancesBySettlementQueryOptions: (
    settlementId: string,
  ) => ({
    queryKey: ["mp-instances-test", settlementId],
    queryFn: () =>
      Promise.resolve(queryData.managedPopulationInstances[settlementId] ?? []),
  }),
}));

vi.mock("@/features/resources", () => ({
  activeResourcesByWorldQueryOptions: () => ({
    queryKey: ["resources-test"],
    queryFn: () => Promise.resolve(queryData.resources),
  }),
}));

vi.mock("@/features/settlements", () => ({
  settlementsByWorldQueryOptions: () => ({
    queryKey: ["settlements-test"],
    queryFn: () => Promise.resolve(queryData.settlements),
  }),
}));

type EffectRow = {
  _id?: string;
  effectType: string;
  isPercent: boolean;
  amountValue: number | null;
  multiplierValue: number | null;
  resourceId: string | null;
  jobId: string | null;
  jobIds?: string[];
  jobMode?: "all" | "select";
  managedPopulationInstanceId: string | null;
  managedPopulationTypeId: string | null;
  managedPopulationMode?: "all" | "type" | "instance";
  depositInstanceId: string | null;
  settlementBuildingId: string | null;
  buildingBlueprintMode?: "all" | "select" | "instance";
  buildingBlueprintIds?: string[];
  buildingInstanceIds?: string[];
};

function renderStep(
  effects: EffectRow[],
  opts: {
    worldId?: string;
    selectedIds?: string[];
    scopeType?: "world" | "nation" | "settlement" | null;
  } = {},
): { onEffectsChange: ReturnType<typeof vi.fn> } {
  const onEffectsChange = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <EventCreateEffectsStep
        effects={effects}
        onEffectsChange={onEffectsChange}
        worldId={opts.worldId ?? "world-1"}
        selectedIds={opts.selectedIds ?? []}
        scopeType={opts.scopeType ?? "world"}
      />
    </QueryClientProvider>,
  );

  return { onEffectsChange };
}

describe("EventCreateEffectsStep", () => {
  beforeEach(() => {
    queryData.resources = [];
    queryData.jobs = [];
    queryData.blueprints = [];
    queryData.settlements = [];
    queryData.managedPopulationTypes = [];
    queryData.managedPopulationInstances = {};
    queryData.buildingsBySettlement = {};
  });

  describe("managed population instance selection", () => {
    it("renders instances as a radio group and selects only one at a time", async () => {
      const user = userEvent.setup();
      queryData.settlements = [
        {
          id: "settlement-1",
          name: "Riverton",
          nationId: "n1",
          nationName: "Nation A",
        },
      ];
      queryData.managedPopulationInstances = {
        "settlement-1": [
          { id: "inst-1", name: "Herd A", managedPopulationTypeName: "Cattle" },
          { id: "inst-2", name: "Herd B", managedPopulationTypeName: "Cattle" },
        ],
      };

      const effect: EffectRow = {
        effectType: "managed_population_change",
        isPercent: false,
        amountValue: 5,
        multiplierValue: null,
        resourceId: null,
        jobId: null,
        managedPopulationInstanceId: null,
        managedPopulationTypeId: null,
        managedPopulationMode: "instance",
        depositInstanceId: null,
        settlementBuildingId: null,
      };

      const { onEffectsChange } = renderStep([effect], {
        scopeType: "settlement",
        selectedIds: ["settlement-1"],
      });

      await screen.findByText(/Herd A/);
      const radios = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input[name="managed-population-instance-0"]',
        ),
      );
      expect(radios).toHaveLength(2);

      await user.click(radios[1]);

      expect(onEffectsChange).toHaveBeenCalledWith([
        expect.objectContaining({ managedPopulationInstanceId: "inst-2" }),
      ]);
    });
  });

  describe("upkeep_multiplier specific-buildings selection", () => {
    it("lists building instances labeled with blueprint and settlement name, grouped by settlement", async () => {
      queryData.settlements = [
        {
          id: "settlement-1",
          name: "Riverton",
          nationId: "n1",
          nationName: "Nation A",
        },
      ];
      queryData.buildingsBySettlement = {
        "settlement-1": [
          { id: "building-1", blueprintName: "Farm" },
          { id: "building-2", blueprintName: "Mill" },
        ],
      };

      const effect: EffectRow = {
        effectType: "upkeep_multiplier",
        isPercent: false,
        amountValue: null,
        multiplierValue: 1.5,
        resourceId: null,
        jobId: null,
        managedPopulationInstanceId: null,
        managedPopulationTypeId: null,
        depositInstanceId: null,
        settlementBuildingId: null,
        buildingBlueprintMode: "instance",
        buildingInstanceIds: [],
      };

      renderStep([effect], {
        scopeType: "settlement",
        selectedIds: ["settlement-1"],
      });

      expect(await screen.findByText("Farm (Riverton)")).toBeInTheDocument();
      expect(screen.getByText("Mill (Riverton)")).toBeInTheDocument();
      expect(screen.getByText("Riverton")).toBeInTheDocument();
    });

    it("checking a building adds its id to buildingInstanceIds", async () => {
      const user = userEvent.setup();
      queryData.settlements = [
        {
          id: "settlement-1",
          name: "Riverton",
          nationId: "n1",
          nationName: "Nation A",
        },
      ];
      queryData.buildingsBySettlement = {
        "settlement-1": [{ id: "building-1", blueprintName: "Farm" }],
      };

      const effect: EffectRow = {
        effectType: "upkeep_multiplier",
        isPercent: false,
        amountValue: null,
        multiplierValue: 1.5,
        resourceId: null,
        jobId: null,
        managedPopulationInstanceId: null,
        managedPopulationTypeId: null,
        depositInstanceId: null,
        settlementBuildingId: null,
        buildingBlueprintMode: "instance",
        buildingInstanceIds: [],
      };

      const { onEffectsChange } = renderStep([effect], {
        scopeType: "settlement",
        selectedIds: ["settlement-1"],
      });

      const checkbox = await screen.findByRole("checkbox");
      await user.click(checkbox);

      expect(onEffectsChange).toHaveBeenCalledWith([
        expect.objectContaining({ buildingInstanceIds: ["building-1"] }),
      ]);
    });

    it("switching to Specific Buildings clears blueprint ids and switching away clears instance ids", async () => {
      const user = userEvent.setup();
      queryData.blueprints = [{ id: "bp-1", name: "Sawmill" }];

      const effect: EffectRow = {
        effectType: "upkeep_multiplier",
        isPercent: false,
        amountValue: null,
        multiplierValue: 1.5,
        resourceId: null,
        jobId: null,
        managedPopulationInstanceId: null,
        managedPopulationTypeId: null,
        depositInstanceId: null,
        settlementBuildingId: null,
        buildingBlueprintMode: "select",
        buildingBlueprintIds: ["bp-1"],
      };

      const { onEffectsChange } = renderStep([effect], { scopeType: "world" });

      const specificBuildingsRadio =
        await screen.findByLabelText("Specific Buildings");
      await user.click(specificBuildingsRadio);

      expect(onEffectsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({
          buildingBlueprintMode: "instance",
          buildingBlueprintIds: undefined,
          buildingInstanceIds: [],
        }),
      ]);
    });
  });

  describe("DOM id uniqueness across repeated effect types", () => {
    it("gives each amount input a distinct id keyed by row index", () => {
      const effects: EffectRow[] = [
        {
          effectType: "population_boost",
          isPercent: false,
          amountValue: 10,
          multiplierValue: null,
          resourceId: null,
          jobId: null,
          managedPopulationInstanceId: null,
          managedPopulationTypeId: null,
          depositInstanceId: null,
          settlementBuildingId: null,
        },
        {
          effectType: "population_boost",
          isPercent: false,
          amountValue: 20,
          multiplierValue: null,
          resourceId: null,
          jobId: null,
          managedPopulationInstanceId: null,
          managedPopulationTypeId: null,
          depositInstanceId: null,
          settlementBuildingId: null,
        },
      ];

      renderStep(effects);

      const amountInputs = document.querySelectorAll('input[id^="amount-"]');
      const ids = Array.from(amountInputs).map((el) => el.id);
      expect(ids).toEqual([
        "amount-0-population_boost",
        "amount-1-population_boost",
      ]);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("population gain effect", () => {
    it("renders the Population Gain card with a Citizens-to-add field and no percent mode toggle", () => {
      const effect: EffectRow = {
        effectType: "population_boost",
        isPercent: false,
        amountValue: 5,
        multiplierValue: null,
        resourceId: null,
        jobId: null,
        managedPopulationInstanceId: null,
        managedPopulationTypeId: null,
        depositInstanceId: null,
        settlementBuildingId: null,
      };

      renderStep([effect]);

      expect(screen.getByText("Population Gain")).toBeInTheDocument();
      expect(screen.getByText("Citizens to add")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Positive number, applied each turn the event is active.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Flat amount")).not.toBeInTheDocument();
      expect(screen.queryByText("Percent of current")).not.toBeInTheDocument();
    });

    it("updates amountValue when the Citizens-to-add input changes", async () => {
      const user = userEvent.setup();
      const effect: EffectRow = {
        effectType: "population_boost",
        isPercent: false,
        amountValue: null,
        multiplierValue: null,
        resourceId: null,
        jobId: null,
        managedPopulationInstanceId: null,
        managedPopulationTypeId: null,
        depositInstanceId: null,
        settlementBuildingId: null,
      };

      const { onEffectsChange } = renderStep([effect]);

      const input = screen.getByLabelText("Citizens to add");
      await user.type(input, "5");

      expect(onEffectsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ amountValue: 5 }),
      ]);
    });
  });

  describe("production multiplier zero-jobs validation", () => {
    it("shows a validation message when Select Jobs mode has no jobs chosen", async () => {
      queryData.jobs = [{ id: "job-1", name: "Farmer" }];

      const effect: EffectRow = {
        effectType: "production_multiplier",
        isPercent: false,
        amountValue: null,
        multiplierValue: 1.5,
        resourceId: null,
        jobId: null,
        jobMode: "select",
        jobIds: [],
        managedPopulationInstanceId: null,
        managedPopulationTypeId: null,
        depositInstanceId: null,
        settlementBuildingId: null,
      };

      renderStep([effect]);

      expect(
        await screen.findByText("Select at least one job, or choose All Jobs."),
      ).toBeInTheDocument();
    });
  });
});
