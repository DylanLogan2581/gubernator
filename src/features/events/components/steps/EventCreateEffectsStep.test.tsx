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
};

const { queryData } = vi.hoisted((): { queryData: MockQueryData } => ({
  queryData: {
    resources: [],
    jobs: [],
    blueprints: [],
    settlements: [],
    managedPopulationTypes: [],
    managedPopulationInstances: {},
  },
}));

vi.mock("@/features/buildings", () => ({
  blueprintsByWorldQueryOptions: () => ({
    queryKey: ["blueprints-test"],
    queryFn: () => Promise.resolve(queryData.blueprints),
  }),
  settlementBuildingsBySettlementQueryOptions: (settlementId: string) => ({
    queryKey: ["buildings-settlement-test", settlementId],
    queryFn: () => Promise.resolve([]),
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
