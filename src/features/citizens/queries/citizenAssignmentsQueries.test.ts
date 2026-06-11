import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  currentAssignmentForCitizenQueryOptions,
  toCitizenAssignment,
} from "./citizenAssignmentsQueries";

import type { CitizenAssignmentRow } from "./citizenAssignmentsQueries";

const BASE_ROW: CitizenAssignmentRow = {
  assigned_on_turn_number: 1,
  assignment_type: "standard_job",
  citizen_id: "citizen-1",
  construction_project: null,
  created_at: "2026-01-01T00:00:00.000Z",
  deposit_instance: null,
  job: null,
  managed_population_instance: null,
  trade_route: null,
  trade_route_end: null,
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("toCitizenAssignment", () => {
  it("maps a standard_job assignment with joined job name", () => {
    const row: CitizenAssignmentRow = {
      ...BASE_ROW,
      assignment_type: "standard_job",
      job: { id: "job-1", name: "Farming" },
    };

    const result = toCitizenAssignment(row);

    expect(result.assignmentType).toBe("standard_job");
    expect(result.job).toEqual({ id: "job-1", name: "Farming" });
    expect(result.constructionProject).toBeNull();
    expect(result.depositInstance).toBeNull();
    expect(result.managedPopulationInstance).toBeNull();
    expect(result.tradeRoute).toBeNull();
  });

  it("maps a construction_project assignment with joined blueprint name and tier", () => {
    const row: CitizenAssignmentRow = {
      ...BASE_ROW,
      assignment_type: "construction_project",
      construction_project: {
        building_blueprint_tiers: { tier_number: 2 },
        building_blueprints: { name: "Granary" },
        id: "proj-1",
      },
    };

    const result = toCitizenAssignment(row);

    expect(result.assignmentType).toBe("construction_project");
    expect(result.constructionProject).toEqual({
      blueprintName: "Granary",
      id: "proj-1",
      tierNumber: 2,
    });
    expect(result.job).toBeNull();
  });

  it("maps a deposit assignment with joined deposit type and job names", () => {
    const row: CitizenAssignmentRow = {
      ...BASE_ROW,
      assignment_type: "deposit",
      deposit_instance: {
        deposit_types: {
          job: { name: "Miner" },
          name: "Iron",
        },
        id: "dep-1",
        name: "Iron Vein",
      },
    };

    const result = toCitizenAssignment(row);

    expect(result.assignmentType).toBe("deposit");
    expect(result.depositInstance).toEqual({
      depositTypeJobName: "Miner",
      depositTypeName: "Iron",
      id: "dep-1",
      name: "Iron Vein",
    });
    expect(result.job).toBeNull();
  });

  it("maps a husbandry assignment with joined population type and job names", () => {
    const row: CitizenAssignmentRow = {
      ...BASE_ROW,
      assignment_type: "husbandry",
      managed_population_instance: {
        id: "pop-1",
        managed_population_types: {
          culling_job: { name: "Slaughter" },
          husbandry_job: { name: "Shepherd" },
        },
        name: "Flock A",
      },
    };

    const result = toCitizenAssignment(row);

    expect(result.assignmentType).toBe("husbandry");
    expect(result.managedPopulationInstance).toEqual({
      cullingJobName: "Slaughter",
      husbandryJobName: "Shepherd",
      id: "pop-1",
      name: "Flock A",
    });
    expect(result.job).toBeNull();
  });

  it("maps a culling assignment with joined population type and job names", () => {
    const row: CitizenAssignmentRow = {
      ...BASE_ROW,
      assignment_type: "culling",
      managed_population_instance: {
        id: "pop-1",
        managed_population_types: {
          culling_job: { name: "Slaughter" },
          husbandry_job: { name: "Shepherd" },
        },
        name: "Flock A",
      },
    };

    const result = toCitizenAssignment(row);

    expect(result.assignmentType).toBe("culling");
    expect(result.managedPopulationInstance?.cullingJobName).toBe("Slaughter");
    expect(result.managedPopulationInstance?.husbandryJobName).toBe("Shepherd");
    expect(result.managedPopulationInstance?.name).toBe("Flock A");
  });

  it("maps a trade_route assignment with a single leg", () => {
    const row: CitizenAssignmentRow = {
      ...BASE_ROW,
      assignment_type: "trade_route",
      trade_route: {
        destination: { name: "Riverside" },
        id: "route-1",
        origin: { name: "Hillfort" },
        trade_route_legs: [{ direction: "send", resource: { name: "Grain" } }],
      },
      trade_route_end: "origin",
    };

    const result = toCitizenAssignment(row);

    expect(result.assignmentType).toBe("trade_route");
    expect(result.tradeRoute).toEqual({
      destinationSettlementName: "Riverside",
      id: "route-1",
      legs: [{ direction: "send", resourceName: "Grain" }],
      originSettlementName: "Hillfort",
    });
    expect(result.tradeRouteEnd).toBe("origin");
    expect(result.job).toBeNull();
  });

  it("maps a trade_route assignment with multiple legs", () => {
    const row: CitizenAssignmentRow = {
      ...BASE_ROW,
      assignment_type: "trade_route",
      trade_route: {
        destination: { name: "Riverside" },
        id: "route-2",
        origin: { name: "Hillfort" },
        trade_route_legs: [
          { direction: "send", resource: { name: "Iron" } },
          { direction: "receive", resource: { name: "Wool" } },
        ],
      },
      trade_route_end: null,
    };

    const result = toCitizenAssignment(row);

    expect(result.tradeRoute?.legs).toEqual([
      { direction: "send", resourceName: "Iron" },
      { direction: "receive", resourceName: "Wool" },
    ]);
  });
});

describe("currentAssignmentForCitizenQueryOptions", () => {
  it("disambiguates deposit_types→job_definitions via named FK constraint", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });

    await queryClient.fetchQuery(
      currentAssignmentForCitizenQueryOptions("citizen-1", client),
    );

    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("deposit_types_job_id_fk"),
    );
  });

  it("embeds trade_route_legs instead of removed resources FK", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });

    await queryClient.fetchQuery(
      currentAssignmentForCitizenQueryOptions("citizen-1", client),
    );

    const selectArg = (select.mock.calls[0] as unknown[])[0] as string;
    expect(selectArg).toContain(
      "trade_route_legs(direction,resource:resources(name))",
    );
  });
});
