export type SchoolEnrollment = {
  readonly citizenId: string;
  readonly citizenName: string;
  readonly enrolledTurnNumber: number;
  readonly id: string;
  readonly progressTurns: number;
  readonly targetLevelId: string;
  readonly targetLevelName: string;
};

export type EnrollCitizenResult = {
  readonly enrollmentId: string;
};

export type UnenrollCitizenResult = {
  readonly enrollmentId: string;
};

// Mirrors supabase/functions/_shared/simulation/simulationTypes.ts EducationSummary
// (jsonb stored verbatim from the sim payload, camelCase keys).
export type EducationSummary = {
  readonly countsByLevelId: Readonly<Record<string, number>>;
  readonly graduationsThisTurn: number;
};

export type SettlementEducationSnapshot = EducationSummary & {
  readonly turnNumber: number;
};
