import { describe, expect, it } from "vitest";


import type { DepositInstance } from "@/features/deposits";

import { buildSettlementAssignmentRows } from "./settlementAssignmentRowsQueries";

import type { SettlementJobCount } from "../types/bulkAssignmentTypes";
import type { CitizenAssignment } from "../types/citizenAssignmentTypes";

describe("buildSettlementAssignmentRows", () => {
  const settlementId = "settlement-1";

  it("creates unassigned row first", () => {
    const { rows } = buildSettlementAssignmentRows(
      [],
      [],
      [],
      [],
      [],
      settlementId,
      5,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      kind: "unassigned",
      unassignedNpcCount: 5,
    });
  });

  it("builds count maps from assignments", () => {
    const deposit: DepositInstance = {
      id: "deposit-1",
      name: "Iron Ore",
      depositTypeJobName: "Mining",
      maxWorkers: 10,
      status: "active",
    } as DepositInstance;

    const assignment: CitizenAssignment = {
      assignmentType: "deposit",
      depositInstance: deposit,
      managedPopulationInstance: null,
      tradeRoute: null,
      tradeRouteEnd: "origin",
    } as CitizenAssignment;

    const { countMaps } = buildSettlementAssignmentRows(
      [],
      [assignment],
      [deposit],
      [],
      [],
      settlementId,
      0,
    );

    expect(countMaps.countByDeposit.get("deposit-1")).toBe(1);
  });

  it("sorts rows alphabetically by job name then target name", () => {
    const jobA: SettlementJobCount = {
      jobId: "job-1",
      jobName: "Farming",
      currentCount: 0,
      capacity: 10,
      jobSlug: "farming",
    } as SettlementJobCount;

    const jobB: SettlementJobCount = {
      jobId: "job-2",
      jobName: "Building",
      currentCount: 0,
      capacity: 10,
      jobSlug: "building",
    } as SettlementJobCount;

    const { rows } = buildSettlementAssignmentRows(
      [jobA, jobB],
      [],
      [],
      [],
      [],
      settlementId,
      0,
    );

    // Unassigned is first
    expect(rows[0]?.kind).toBe("unassigned");
    // Then Building (alphabetically first)
    expect(rows[1]?.kind).toBe("bulk");
    if (rows[1]?.kind === "bulk") {
      expect(rows[1].job.jobName).toBe("Building");
    }
    // Then Farming
    expect(rows[2]?.kind).toBe("bulk");
    if (rows[2]?.kind === "bulk") {
      expect(rows[2].job.jobName).toBe("Farming");
    }
  });

  it("keeps unassigned row pinned first after sorting", () => {
    const job: SettlementJobCount = {
      jobId: "job-1",
      jobName: "Aardvark Herding",
      currentCount: 0,
      capacity: 10,
      jobSlug: "aardvark-herding",
    } as SettlementJobCount;

    const { rows } = buildSettlementAssignmentRows(
      [job],
      [],
      [],
      [],
      [],
      settlementId,
      10,
    );

    expect(rows[0]?.kind).toBe("unassigned");
    expect(rows[0]?.unassignedNpcCount).toBe(10);
  });
});
