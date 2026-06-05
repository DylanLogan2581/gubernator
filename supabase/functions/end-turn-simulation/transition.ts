// Runs the simulation engine and maps the SimulationResult to the JSONB
// payload shape expected by the apply_turn_transition RPC.

import {
  runSimulation,
  SimulationRejectionError,
} from "../_shared/simulation/runSimulation.ts";

import type { EndTurnSimulationErrorResponse } from "./types.ts";
import type {
  AssignmentClear,
  DeathCauseCategory,
  DepositUpdate,
  ManagedPopulationUpdate,
  ReadinessSummary,
  SettlementSnapshot,
  SimConstructionStatus,
  SimulationInputState,
  SimulationLogEntry,
  SimulationNotification,
  SimulationResult,
} from "../_shared/simulation/simulationTypes.ts";

// ---------------------------------------------------------------------------
// Payload entry types — match the apply_turn_transition JSONB contract
// (§C28–§C35 in the migration comments)
// ---------------------------------------------------------------------------

type StockpileDeltaEntry = {
  readonly consumed: number;
  readonly produced: number;
  readonly quantityAfter: number;
  readonly quantityBefore: number;
  readonly resourceId: string;
  readonly settlementId: string;
  readonly tradeIn: number;
  readonly tradeOut: number;
};

type ConstructionUpdateEntry = {
  readonly activatedOnTurnNumber?: number;
  readonly projectId: string;
  readonly progressWorkerTurns: number;
  readonly status: SimConstructionStatus;
};

type BuildingCreatedEntry = {
  readonly buildingBlueprintId: string;
  readonly currentTierId: string;
  readonly settlementId: string;
};

type BuildingStateChangeEntry = {
  readonly buildingId: string;
  readonly missedUpkeepCount: number;
  readonly state: string;
};

type TradeRouteOutcomeEntry = {
  readonly pauseReason: string | null;
  readonly toStatus: "active" | "paused";
  readonly tradeRouteId: string;
};

type CitizenBirthEntry = {
  readonly bornOnTurnNumber: number;
  readonly npcFlaw: string | null;
  readonly npcGoal: string | null;
  readonly npcSecretContradiction: string | null;
  readonly npcTrait1: string | null;
  readonly npcTrait2: string | null;
  readonly parentACitizenId: string | null;
  readonly parentBCitizenId: string | null;
  readonly sex: string;
  readonly settlementId: string;
};

type CitizenDeathEntry = {
  readonly citizenId: string;
  readonly deathCause: string | null;
  readonly deathCauseCategory: DeathCauseCategory;
};

type PartnershipChangeEntry = {
  readonly citizenAId: string;
  readonly citizenBId: string;
  readonly endedOnTurnNumber?: number;
  readonly formedOnTurnNumber?: number;
  readonly toStatus: "active" | "dissolved" | "widowed";
};

// ---------------------------------------------------------------------------
// Public payload type
// ---------------------------------------------------------------------------

export type ApplyTurnTransitionPayload = {
  readonly assignmentClears: readonly AssignmentClear[];
  readonly bornOnTurnBackfill: ReadonlyArray<{
    readonly bornOnTurnNumber: number;
    readonly citizenId: string;
  }>;
  readonly buildingStateChanges: readonly BuildingStateChangeEntry[];
  readonly buildingsCreated: readonly BuildingCreatedEntry[];
  readonly citizenBirths: readonly CitizenBirthEntry[];
  readonly citizenDeaths: readonly CitizenDeathEntry[];
  readonly constructionUpdates: readonly ConstructionUpdateEntry[];
  readonly depositUpdates: readonly DepositUpdate[];
  readonly logEntries: readonly SimulationLogEntry[];
  readonly managedPopulationUpdates: readonly ManagedPopulationUpdate[];
  readonly notifications: readonly SimulationNotification[];
  readonly partnershipChanges: readonly PartnershipChangeEntry[];
  readonly readinessSummary: ReadinessSummary;
  readonly settlementSnapshots: readonly SettlementSnapshot[];
  readonly stockpileDeltas: readonly StockpileDeltaEntry[];
  readonly tradeRouteOutcomes: readonly TradeRouteOutcomeEntry[];
};

// ---------------------------------------------------------------------------
// planSimulationTransition return type
// ---------------------------------------------------------------------------

export type SimulationTransitionResult =
  | {
      readonly ok: true;
      readonly payload: ApplyTurnTransitionPayload;
      readonly result: SimulationResult;
      readonly transitionId: string;
    }
  | {
      readonly error: EndTurnSimulationErrorResponse;
      readonly ok: false;
      readonly status: number;
    };

// ---------------------------------------------------------------------------
// planSimulationTransition
// ---------------------------------------------------------------------------

export function planSimulationTransition(
  input: SimulationInputState,
  transitionId: string,
): SimulationTransitionResult {
  let result: SimulationResult;
  try {
    result = runSimulation(input, transitionId);
  } catch (error) {
    if (error instanceof SimulationRejectionError) {
      if (error.code === "world_archived") {
        return {
          error: {
            error: {
              code: "end_turn_world_archived",
              message: error.message,
            },
            ok: false,
          },
          ok: false,
          status: 409,
        };
      }
      return {
        error: {
          error: {
            code: "end_turn_transition_failed",
            message: error.message,
          },
          ok: false,
        },
        ok: false,
        status: 422,
      };
    }
    throw error;
  }

  const payload = mapSimulationResultToPayload(result, input);
  return { ok: true, payload, result, transitionId };
}

// ---------------------------------------------------------------------------
// mapSimulationResultToPayload
// ---------------------------------------------------------------------------

export function mapSimulationResultToPayload(
  result: SimulationResult,
  input: SimulationInputState,
): ApplyTurnTransitionPayload {
  const newTurnNumber = input.turnNumber + 1;

  // §C28: stockpileDeltas — engine produces ResourceSnapshot objects; the RPC
  // expects the same shape under the 'stockpileDeltas' key.
  const stockpileDeltas: StockpileDeltaEntry[] = result.resourceSnapshots.map(
    (snap) => ({
      consumed: snap.consumed,
      produced: snap.produced,
      quantityAfter: snap.quantityAfter,
      quantityBefore: snap.quantityBefore,
      resourceId: snap.resourceId,
      settlementId: snap.settlementId,
      tradeIn: snap.tradeIn,
      tradeOut: snap.tradeOut,
    }),
  );

  // §C29a: constructionUpdates — convert delta to absolute progressWorkerTurns.
  // activatedOnTurnNumber is set only when the project transitions to 'in_progress'
  // for the first time (was 'queued' before).
  const projectById = new Map(input.constructionProjects.map((p) => [p.id, p]));
  const constructionUpdates: ConstructionUpdateEntry[] =
    result.constructionUpdates.map((upd) => {
      const project = projectById.get(upd.projectId);
      const currentProgress = project?.progressWorkerTurns ?? 0;
      const currentStatus = project?.status ?? "queued";
      const newStatus: SimConstructionStatus = upd.toStatus ?? currentStatus;
      const entry: ConstructionUpdateEntry = {
        projectId: upd.projectId,
        progressWorkerTurns: currentProgress + upd.progressWorkerTurnsDelta,
        status: newStatus,
      };
      // Only stamp activatedOnTurnNumber when the project first becomes in_progress.
      if (currentStatus === "queued" && newStatus === "in_progress") {
        return { ...entry, activatedOnTurnNumber: newTurnNumber };
      }
      return entry;
    });

  // §C29b: buildingsCreated — rename tierId → currentTierId.
  const buildingsCreated: BuildingCreatedEntry[] = result.buildingsCreated.map(
    (b) => ({
      buildingBlueprintId: b.buildingBlueprintId,
      currentTierId: b.tierId,
      settlementId: b.settlementId,
    }),
  );

  // §C29c: buildingStateChanges — convert missedUpkeepCountDelta to absolute value.
  const buildingById = new Map(input.settlementBuildings.map((b) => [b.id, b]));
  const buildingStateChanges: BuildingStateChangeEntry[] =
    result.buildingStateChanges.map((sc) => {
      const building = buildingById.get(sc.settlementBuildingId);
      const baseMissed = building?.missedUpkeepCount ?? 0;
      return {
        buildingId: sc.settlementBuildingId,
        missedUpkeepCount: baseMissed + (sc.missedUpkeepCountDelta ?? 0),
        state: sc.toState,
      };
    });

  // §C31: tradeRouteOutcomes — derive toStatus from pauseReason.
  const tradeRouteOutcomes: TradeRouteOutcomeEntry[] =
    result.tradeRouteOutcomes.map((tro) => ({
      pauseReason: tro.pauseReason,
      toStatus: tro.pauseReason !== null ? "paused" : "active",
      tradeRouteId: tro.tradeRouteId,
    }));

  // §C32 pre-pass: bornOnTurnBackfill — CitizenPatch fields match the payload contract.
  const bornOnTurnBackfill = result.citizenPatches.map((cp) => ({
    bornOnTurnNumber: cp.bornOnTurnNumber,
    citizenId: cp.citizenId,
  }));

  // §C32a: citizenBirths — add bornOnTurnNumber from the new turn.
  const citizenBirths: CitizenBirthEntry[] = result.citizenBirths.map((b) => ({
    bornOnTurnNumber: newTurnNumber,
    npcFlaw: b.npcFlaw,
    npcGoal: b.npcGoal,
    npcSecretContradiction: b.npcSecretContradiction,
    npcTrait1: b.npcTrait1,
    npcTrait2: b.npcTrait2,
    parentACitizenId: b.parentACitizenId ?? null,
    parentBCitizenId: b.parentBCitizenId ?? null,
    sex: b.sex,
    settlementId: b.settlementId,
  }));

  // §C32b: citizenDeaths — rename category → deathCauseCategory, detail → deathCause.
  const citizenDeaths: CitizenDeathEntry[] = result.citizenDeaths.map((d) => ({
    citizenId: d.citizenId,
    deathCause: d.detail,
    deathCauseCategory: d.category,
  }));

  // §C32c: partnershipChanges — flatten discriminated union; resolve partnershipId
  // to citizenAId/citizenBId for status_changed entries.
  const partnershipById = new Map(input.partnerships.map((p) => [p.id, p]));
  const partnershipChanges: PartnershipChangeEntry[] =
    result.partnershipChanges.map((pc) => {
      if (pc.type === "formed") {
        return {
          citizenAId: pc.citizenAId,
          citizenBId: pc.citizenBId,
          formedOnTurnNumber: newTurnNumber,
          toStatus: "active",
        };
      }
      const partnership = partnershipById.get(pc.partnershipId);
      if (partnership === undefined) {
        throw new Error(
          `Partnership ${pc.partnershipId} not found in input state`,
        );
      }
      return {
        citizenAId: partnership.citizenAId,
        citizenBId: partnership.citizenBId,
        endedOnTurnNumber: newTurnNumber,
        toStatus: pc.toStatus,
      };
    });

  return {
    assignmentClears: result.assignmentClears,
    bornOnTurnBackfill,
    buildingStateChanges,
    buildingsCreated,
    citizenBirths,
    citizenDeaths,
    constructionUpdates,
    depositUpdates: result.depositUpdates,
    logEntries: result.logEntries,
    managedPopulationUpdates: result.managedPopulationUpdates,
    notifications: result.notifications,
    partnershipChanges,
    readinessSummary: result.readinessSummary,
    settlementSnapshots: result.settlementSnapshots,
    stockpileDeltas,
    tradeRouteOutcomes,
  };
}
