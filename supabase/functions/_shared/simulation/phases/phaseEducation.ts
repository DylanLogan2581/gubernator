// Phase: education — enrollment progress, teacher staffing, graduation.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { compareById } from "../sortUtils.ts";

import type {
  BuildingStateChange,
  CitizenEducationPatch,
  EducationSummary,
  EnrollmentGraduation,
  EnrollmentProgressUpdate,
  SimCitizen,
  SimEducationEnrollment,
  SimTierEffect,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
} from "../simulationTypes.ts";

type EducationEffect = Extract<SimTierEffect, { type: "education" }>;

function findEducationEffect(
  effects: readonly SimTierEffect[],
): EducationEffect | undefined {
  return effects.find((e): e is EducationEffect => e.type === "education");
}

export type PhaseEducationOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
  readonly citizenEducationPatches: readonly CitizenEducationPatch[];
  readonly enrollmentProgressUpdates: readonly EnrollmentProgressUpdate[];
  readonly enrollmentGraduations: readonly EnrollmentGraduation[];
  readonly educationSummaryBySettlementId: ReadonlyMap<string, EducationSummary>;
};

// Per-settlement accumulator for the batched graduation log/notification.
// combos tracks distinct "<levelName>@@<buildingName>" pairs so the message
// can stay precise ("N citizens completed Basic at the Schoolhouse") when
// exactly one combo graduated this turn, and fall back to a generic summary
// when multiple school/level combos graduated in the same settlement.
type SettlementGraduationInfo = {
  count: number;
  combos: Set<string>;
};

export function phaseEducation(
  context: SimulationContext,
  buildingStateChanges: readonly BuildingStateChange[],
): PhaseEducationOutput {
  const {
    buildingBlueprints,
    buildingTiers,
    citizenAssignments,
    citizens,
    educationEnrollments,
    educationLevels,
    jobs,
    nationOffices,
    settlementBuildings,
    unitSoldiers,
  } = context.input;

  const tierById = new Map(buildingTiers.map((t) => [t.id, t]));
  const buildingById = new Map(settlementBuildings.map((b) => [b.id, b]));
  const levelById = new Map(educationLevels.map((l) => [l.id, l]));
  const citizenById = new Map(citizens.map((c) => [c.id, c]));
  const blueprintNameById = new Map(buildingBlueprints.map((bp) => [bp.id, bp.name]));
  const officeholderCitizenIds = new Set(
    nationOffices.filter((o) => o.excludesFromLabor).map((o) => o.citizenId),
  );
  const enrolledCitizenIds = new Set(educationEnrollments.map((e) => e.citizenId));
  const soldierCitizenIds = new Set(unitSoldiers.map((s) => s.citizenId));

  // Effective building state this turn: base state overridden by any change
  // that happened in phaseBuildingUpkeep/phaseEvents this turn (mirrors
  // settlementSnapshotBuilder.ts's finalBuildingStateById pattern).
  const finalStateById = new Map(settlementBuildings.map((b) => [b.id, b.state]));
  for (const change of buildingStateChanges) {
    finalStateById.set(change.settlementBuildingId, change.toState);
  }

  const enrollmentsByBuilding = new Map<string, SimEducationEnrollment[]>();
  for (const e of educationEnrollments) {
    const list = enrollmentsByBuilding.get(e.settlementBuildingId);
    if (list === undefined) {
      enrollmentsByBuilding.set(e.settlementBuildingId, [e]);
    } else {
      list.push(e);
    }
  }
  for (const list of enrollmentsByBuilding.values()) {
    list.sort(compareById);
  }

  function levelRank(levelId: string | null): number | null {
    if (levelId === null) return null;
    return levelById.get(levelId)?.rank ?? null;
  }

  // A citizen qualifies for a job iff their education level rank >= the
  // job's required level rank. No requirement (null) = everyone qualifies.
  // An uneducated citizen (null level) only qualifies for unrequired jobs.
  function citizenQualifies(citizen: SimCitizen, requiredLevelId: string | null): boolean {
    if (requiredLevelId === null) return true;
    const citizenRank = levelRank(citizen.educationLevelId);
    const requiredRank = levelRank(requiredLevelId);
    if (citizenRank === null || requiredRank === null) return false;
    return citizenRank >= requiredRank;
  }

  const logs: SimulationLogEntry[] = [];
  const notifications: SimulationNotification[] = [];
  const citizenEducationPatches: CitizenEducationPatch[] = [];
  const enrollmentProgressUpdates: EnrollmentProgressUpdate[] = [];
  const enrollmentGraduations: EnrollmentGraduation[] = [];

  // Tracks each still-enrolled enrollment's end-of-turn target level id, for
  // the countsByLevelId summary. Graduated (deleted) enrollments are removed.
  const targetLevelByEnrollmentId = new Map(
    educationEnrollments.map((e) => [e.id, e.targetLevelId]),
  );
  const graduatedEnrollmentIds = new Set<string>();
  const gradInfoBySettlement = new Map<string, SettlementGraduationInfo>();

  const schoolsSorted = settlementBuildings
    .filter((b) => {
      const tier = tierById.get(b.currentTierId);
      return (
        tier !== undefined &&
        findEducationEffect(tier.effectsJson) !== undefined &&
        (enrollmentsByBuilding.get(b.id)?.length ?? 0) > 0
      );
    })
    .slice()
    .sort(compareById);

  for (const building of schoolsSorted) {
    const tier = tierById.get(building.currentTierId);
    const config = tier !== undefined ? findEducationEffect(tier.effectsJson) : undefined;
    if (config === undefined) continue;

    const enrollments = enrollmentsByBuilding.get(building.id) ?? [];
    if (enrollments.length === 0) continue;

    const sid = building.settlementId;
    const effectiveState = finalStateById.get(building.id) ?? building.state;

    // Inactive this turn (including buildings that went inactive this turn
    // per buildingStateChanges): the school teaches nothing, no-op entirely.
    // Enrollments still count toward countsByLevelId below since they still
    // exist and their target level is unchanged.
    if (effectiveState !== "active") continue;

    const students = enrollments.length;
    const requiredTeachers = Math.ceil(students / config.studentsPerTeacher);

    const teacherJob = jobs.find((j) => j.id === config.teacherJobId);
    const requiredTeacherLevelId = teacherJob?.requiredEducationLevelId ?? null;

    // Note: teacher counts are computed per-school from the settlement's
    // full assignment pool. If two schools in the same settlement share a
    // teacherJobId, the same citizens can satisfy both schools' staffing
    // checks simultaneously — this mirrors the brief's per-building
    // computation and does not attempt cross-school teacher deduplication.
    let actualTeachers = 0;
    for (const assignment of citizenAssignments) {
      if (assignment.assignmentType !== "standard_job") continue;
      if (assignment.jobId !== config.teacherJobId) continue;
      if (
        officeholderCitizenIds.has(assignment.citizenId) ||
        enrolledCitizenIds.has(assignment.citizenId) ||
        soldierCitizenIds.has(assignment.citizenId)
      ) {
        continue;
      }
      const citizen = citizenById.get(assignment.citizenId);
      if (citizen === undefined || citizen.settlementId !== sid) continue;
      if (!citizenQualifies(citizen, requiredTeacherLevelId)) continue;
      actualTeachers++;
    }

    // teacherCapacity bounds the building's own teacher slots, independent
    // of the job's global settlement capacity.
    const effectiveTeachers = Math.min(actualTeachers, config.teacherCapacity);

    if (effectiveTeachers < requiredTeachers) {
      logs.push({
        category: "education.understaffed",
        payload: {
          message: `School understaffed: ${effectiveTeachers} teacher${
            effectiveTeachers === 1 ? "" : "s"
          } for ${students} student${students === 1 ? "" : "s"}.`,
          settlementBuildingId: building.id,
          studentCount: students,
          teacherCount: effectiveTeachers,
        },
        phase: "education",
        settlementId: sid,
      });
      continue;
    }

    for (const enrollment of enrollments) {
      const citizen = citizenById.get(enrollment.citizenId);
      const transition = config.levels.find(
        (l) =>
          l.fromLevelId === (citizen?.educationLevelId ?? null) &&
          l.toLevelId === enrollment.targetLevelId,
      );
      // Should always be found given enroll_citizen only ever targets a
      // level reachable by an explicit transition from the citizen's
      // current level; defensively treat a missing transition as never
      // completing rather than crashing the turn.
      if (transition === undefined) continue;

      const newProgress = enrollment.progressTurns + 1;

      if (newProgress < transition.turns) {
        enrollmentProgressUpdates.push({
          enrollmentId: enrollment.id,
          progressTurns: newProgress,
          targetLevelId: enrollment.targetLevelId,
        });
        continue;
      }

      // Level completed this turn.
      citizenEducationPatches.push({
        citizenId: enrollment.citizenId,
        educationLevelId: enrollment.targetLevelId,
      });

      const reachedLevel = levelById.get(enrollment.targetLevelId);

      // Find the next explicit transition offered from the level just
      // reached, if any.
      const nextTransition = config.levels.find(
        (l) => l.fromLevelId === enrollment.targetLevelId,
      );
      const nextLevel =
        nextTransition !== undefined ? levelById.get(nextTransition.toLevelId) : undefined;

      if (nextLevel !== undefined) {
        enrollmentProgressUpdates.push({
          enrollmentId: enrollment.id,
          progressTurns: 0,
          targetLevelId: nextLevel.id,
        });
        targetLevelByEnrollmentId.set(enrollment.id, nextLevel.id);
      } else {
        enrollmentGraduations.push({ enrollmentId: enrollment.id });
        graduatedEnrollmentIds.add(enrollment.id);
        targetLevelByEnrollmentId.delete(enrollment.id);
      }

      const grad = gradInfoBySettlement.get(sid) ?? { combos: new Set<string>(), count: 0 };
      grad.count += 1;
      const levelName = reachedLevel?.name ?? "an unknown level";
      const buildingName = blueprintNameById.get(building.buildingBlueprintId) ?? "an unknown building";
      grad.combos.add(`${levelName}@@${buildingName}`);
      gradInfoBySettlement.set(sid, grad);
    }
  }

  // -------------------------------------------------------------------------
  // Batched per-settlement graduation log + notification
  // -------------------------------------------------------------------------

  for (const [sid, info] of gradInfoBySettlement) {
    if (info.count === 0) continue;

    logs.push({
      category: "education.graduated",
      payload: {
        combos: [...info.combos],
        count: info.count,
      },
      phase: "education",
      settlementId: sid,
    });

    let messageText: string;
    if (info.combos.size === 1) {
      const [combo] = info.combos;
      const [levelName, buildingName] = (combo ?? "@@").split("@@");
      messageText = `${info.count} citizen${
        info.count === 1 ? "" : "s"
      } completed ${levelName} at the ${buildingName}.`;
    } else {
      messageText = `${info.count} citizens completed schooling at ${info.combos.size} school(s) this turn.`;
    }

    notifications.push({
      messageText,
      notificationType: "education.graduated",
      scope: "settlement",
      settlementId: sid,
    });
  }

  // -------------------------------------------------------------------------
  // Per-settlement education summary (used by the settlement snapshot)
  // -------------------------------------------------------------------------

  const countsBySettlement = new Map<string, Map<string, number>>();
  for (const e of educationEnrollments) {
    if (graduatedEnrollmentIds.has(e.id)) continue;
    const building = buildingById.get(e.settlementBuildingId);
    if (building === undefined) continue;
    const levelId = targetLevelByEnrollmentId.get(e.id) ?? e.targetLevelId;
    const map = countsBySettlement.get(building.settlementId) ?? new Map<string, number>();
    map.set(levelId, (map.get(levelId) ?? 0) + 1);
    countsBySettlement.set(building.settlementId, map);
  }

  const settlementIdsWithData = new Set<string>([
    ...countsBySettlement.keys(),
    ...gradInfoBySettlement.keys(),
  ]);

  const educationSummaryBySettlementId = new Map<string, EducationSummary>();
  for (const sid of settlementIdsWithData) {
    const countsMap = countsBySettlement.get(sid);
    const countsByLevelId: Record<string, number> = {};
    if (countsMap !== undefined) {
      for (const [levelId, count] of countsMap) {
        countsByLevelId[levelId] = count;
      }
    }
    educationSummaryBySettlementId.set(sid, {
      countsByLevelId,
      graduationsThisTurn: gradInfoBySettlement.get(sid)?.count ?? 0,
    });
  }

  return {
    citizenEducationPatches,
    educationSummaryBySettlementId,
    enrollmentGraduations,
    enrollmentProgressUpdates,
    logs,
    notifications,
  };
}
