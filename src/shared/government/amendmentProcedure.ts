/**
 * Amendment procedure engine (#1118).
 *
 * Cross-runtime module: no browser APIs, no @/ alias, explicit .ts
 * extensions. Every law_documents row stores its amendment_procedure_json
 * opaquely (#1117); this module is the single source of truth for its shape
 * and for the pure decisions ("can this actor propose a change right now?",
 * "did this vote pass?") that both the browser and the Deno amendment/vote
 * RPCs (a later issue) must agree on. Persisting proposals, casting votes,
 * and turn-based expiry are out of scope here -- see the amendments issue.
 *
 * A `set_procedure` amendment (an amendment whose payload replaces the
 * document's own procedure) is ratified under the CURRENT procedure like any
 * other amendment: the later issue validates the new procedure json with
 * `validateAmendmentProcedure` before persisting it, same as this module's
 * own callers.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export class AmendmentProcedureValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmendmentProcedureValidationError";
  }
}

export type DecreeAuthority = "ruler" | { readonly officeTypeId: string };

export type DecreeAmendmentProcedure = {
  readonly kind: "decree";
  readonly authority: DecreeAuthority;
};

export const VOTE_THRESHOLDS = [
  "majority",
  "two_thirds",
  "three_quarters",
  "unanimous",
] as const;

export type VoteThreshold = (typeof VOTE_THRESHOLDS)[number];

export type VoteAmendmentProcedure = {
  readonly kind: "vote";
  readonly bodyId: string;
  readonly threshold: VoteThreshold;
  readonly votingPeriodTurns: number;
  readonly secondBodyId: string | null;
};

export type LockedAmendmentProcedure = {
  readonly kind: "locked";
};

export type AmendmentProcedure =
  | DecreeAmendmentProcedure
  | VoteAmendmentProcedure
  | LockedAmendmentProcedure;

function fail(message: string): never {
  throw new AmendmentProcedureValidationError(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDecreeProcedure(
  value: Record<string, unknown>,
): DecreeAmendmentProcedure {
  const authority = value["authority"];

  if (authority === "ruler") {
    return { kind: "decree", authority: "ruler" };
  }

  if (
    isPlainObject(authority) &&
    Object.keys(authority).length === 1 &&
    isUuid(authority["officeTypeId"])
  ) {
    return {
      kind: "decree",
      authority: { officeTypeId: authority["officeTypeId"] },
    };
  }

  fail('Decree authority must be "ruler" or { officeTypeId: uuid }.');
}

function parseVoteProcedure(
  value: Record<string, unknown>,
): VoteAmendmentProcedure {
  const bodyId = value["bodyId"];
  if (!isUuid(bodyId)) {
    fail("Vote procedure requires a valid bodyId.");
  }

  const threshold = value["threshold"];
  if (
    typeof threshold !== "string" ||
    !(VOTE_THRESHOLDS as readonly string[]).includes(threshold)
  ) {
    fail(
      "Vote threshold must be one of majority, two_thirds, three_quarters, unanimous.",
    );
  }

  const votingPeriodTurns = value["votingPeriodTurns"];
  if (
    typeof votingPeriodTurns !== "number" ||
    !Number.isInteger(votingPeriodTurns) ||
    votingPeriodTurns < 1
  ) {
    fail("Voting period must be an integer of at least 1 turn.");
  }

  const secondBodyIdRaw = value["secondBodyId"] ?? null;
  if (secondBodyIdRaw !== null && !isUuid(secondBodyIdRaw)) {
    fail("Second body must be a valid uuid or null.");
  }
  const secondBodyId: string | null = secondBodyIdRaw;

  if (secondBodyId !== null && secondBodyId === bodyId) {
    fail("Second body must differ from first");
  }

  return {
    kind: "vote",
    bodyId,
    threshold: threshold as VoteThreshold,
    votingPeriodTurns,
    secondBodyId,
  };
}

/**
 * Validates the shape of an amendment_procedure_json value (already parsed
 * from jsonb). Throws AmendmentProcedureValidationError with a user-facing
 * message on any malformed input. Does not check that a referenced body
 * exists or is in scope -- see assertAmendmentProcedureBodiesExist for that,
 * since it requires data this pure function does not have.
 */
export function validateAmendmentProcedure(value: unknown): AmendmentProcedure {
  if (!isPlainObject(value)) {
    fail("Amendment procedure must be an object.");
  }

  switch (value["kind"]) {
    case "decree":
      return parseDecreeProcedure(value);
    case "vote":
      return parseVoteProcedure(value);
    case "locked":
      return { kind: "locked" };
    default:
      fail('Amendment procedure kind must be "decree", "vote", or "locked".');
  }
}

/**
 * Guards a vote-kind procedure's body references against the set of
 * government body ids valid in the document's own scope (nation or
 * settlement). Callers must pass only in-scope body ids -- this function
 * does not itself know the document's scope.
 */
export function assertAmendmentProcedureBodiesExist(
  procedure: AmendmentProcedure,
  scopeBodyIds: ReadonlySet<string> | readonly string[],
): void {
  if (procedure.kind !== "vote") {
    return;
  }

  const scope =
    scopeBodyIds instanceof Set ? scopeBodyIds : new Set(scopeBodyIds);

  if (!scope.has(procedure.bodyId)) {
    fail("Procedure body not found");
  }
  if (procedure.secondBodyId !== null && !scope.has(procedure.secondBodyId)) {
    fail("Procedure body not found");
  }
}

export type AmendmentActor = {
  readonly isWorldAdmin: boolean;
  readonly isSuperAdmin: boolean;
  /** True when the actor is the current ruler citizen (nation manager /
   * settlement manager) of the document's own nation or settlement. */
  readonly isRuler: boolean;
  readonly heldOfficeTypeIds: ReadonlySet<string> | readonly string[];
  /** Body ids the actor is currently a resolved member of, per
   * resolveBodyMembers. Only relevant for vote-kind procedures. */
  readonly memberOfBodyIds: ReadonlySet<string> | readonly string[];
};

function toSet(value: ReadonlySet<string> | readonly string[]): Set<string> {
  return new Set(value);
}

/**
 * Whether actor is currently allowed to bring an amendment forward under the
 * document's procedure. World/super admins can always propose, mirroring the
 * existing repeal_law_document escape hatch (#1117) -- this is an
 * intentional override, not a bug: admins can act under any procedure kind,
 * including locked. For vote-kind, "propose" means the actor sits in the
 * governing body (or, bicameral, either chamber); actually passing the
 * amendment still requires evaluateVote to report passed.
 */
export function canProposeAmendment(
  procedure: AmendmentProcedure,
  actor: AmendmentActor,
): boolean {
  if (actor.isWorldAdmin || actor.isSuperAdmin) {
    return true;
  }

  switch (procedure.kind) {
    case "locked":
      return false;
    case "decree": {
      if (procedure.authority === "ruler") {
        return actor.isRuler;
      }
      return toSet(actor.heldOfficeTypeIds).has(
        procedure.authority.officeTypeId,
      );
    }
    case "vote": {
      const memberships = toSet(actor.memberOfBodyIds);
      return (
        memberships.has(procedure.bodyId) ||
        (procedure.secondBodyId !== null &&
          memberships.has(procedure.secondBodyId))
      );
    }
  }
}

export type VoteChoice = "yes" | "no" | "abstain";

export type VoteCast = {
  readonly citizenId: string;
  readonly choice: VoteChoice;
};

export type VoteMembers = {
  readonly bodyMemberCitizenIds: readonly string[];
  /** Required when the procedure is bicameral (secondBodyId set). */
  readonly secondBodyMemberCitizenIds?: readonly string[];
};

export type ChamberVoteTally = {
  readonly memberCount: number;
  readonly yes: number;
  readonly no: number;
  readonly abstain: number;
  /** Members who cast no vote at all. Counted against the threshold exactly
   * like an explicit abstain -- see module doc / evaluateVote doc. */
  readonly nonVoters: number;
  readonly passed: boolean;
};

export type VoteEvaluationResult = {
  readonly passed: boolean;
  readonly firstChamber: ChamberVoteTally;
  /** Null unless the procedure is bicameral (secondBodyId set). */
  readonly secondChamber: ChamberVoteTally | null;
};

function meetsThreshold(
  yes: number,
  memberCount: number,
  threshold: VoteThreshold,
): boolean {
  if (memberCount === 0) {
    return false;
  }
  switch (threshold) {
    case "majority":
      return yes * 2 > memberCount;
    case "two_thirds":
      return yes * 3 >= memberCount * 2;
    case "three_quarters":
      return yes * 4 >= memberCount * 3;
    case "unanimous":
      return yes === memberCount;
  }
}

/**
 * Tallies one chamber's votes. A citizen not present in memberCitizenIds is
 * ignored (not a member, so their vote does not count). Non-voting members
 * -- and abstentions -- both fall short of "yes", so both count against the
 * threshold: this is a deliberate choice (a supermajority procedure should
 * not pass on a low-turnout plurality of yes votes) and callers relying on
 * turn-based voting-period expiry (later issue) should tally once the period
 * closes, at which point every member who never voted is a non-voter here.
 */
function tallyChamber(
  votes: readonly VoteCast[],
  memberCitizenIds: readonly string[],
  threshold: VoteThreshold,
): ChamberVoteTally {
  const members = new Set(memberCitizenIds);
  const choiceByCitizenId = new Map<string, VoteChoice>();
  for (const vote of votes) {
    if (members.has(vote.citizenId)) {
      // Last vote for a citizen wins, so re-casting a vote is well-defined.
      choiceByCitizenId.set(vote.citizenId, vote.choice);
    }
  }

  let yes = 0;
  let no = 0;
  let abstain = 0;
  for (const choice of choiceByCitizenId.values()) {
    if (choice === "yes") yes += 1;
    else if (choice === "no") no += 1;
    else abstain += 1;
  }

  const memberCount = members.size;
  const nonVoters = memberCount - choiceByCitizenId.size;

  return {
    memberCount,
    yes,
    no,
    abstain,
    nonVoters,
    passed: meetsThreshold(yes, memberCount, threshold),
  };
}

/**
 * Evaluates a vote-kind procedure's outcome given the cast votes and the
 * resolved member rosters (from resolveBodyMembers) for each chamber. For a
 * bicameral procedure (secondBodyId set), both chambers must independently
 * pass.
 */
export function evaluateVote(
  procedure: VoteAmendmentProcedure,
  votes: readonly VoteCast[],
  members: VoteMembers,
): VoteEvaluationResult {
  const firstChamber = tallyChamber(
    votes,
    members.bodyMemberCitizenIds,
    procedure.threshold,
  );

  if (procedure.secondBodyId === null) {
    return { passed: firstChamber.passed, firstChamber, secondChamber: null };
  }

  const secondChamber = tallyChamber(
    votes,
    members.secondBodyMemberCitizenIds ?? [],
    procedure.threshold,
  );

  return {
    passed: firstChamber.passed && secondChamber.passed,
    firstChamber,
    secondChamber,
  };
}
