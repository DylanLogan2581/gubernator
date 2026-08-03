import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import {
  resolveBodyMembers,
  validateAmendmentProcedure,
  type BodyCompositionRule,
} from "@/shared/government";

import { lawAmendmentsQueryKeys } from "./lawAmendmentsQueryKeys";

// Sidebar "Government" tab badge (#1120): counts law_amendments in this
// nation/settlement's documents that are still open for a vote (status
// "proposed", vote-kind procedure) where the viewer's own active player
// character is a resolved member of the procedure's body/secondBodyId and
// has not yet cast a vote. Admins never see this badge (they aren't voting
// as themselves); a handful of documents/amendments per nation is the
// expected scale, so this is a few small sequential Supabase calls rather
// than a dedicated RPC -- matching nationReadinessVotersQueries.ts.

type ScopeDocumentRow = {
  readonly amendment_procedure_json: unknown;
  readonly id: string;
};

type ProposedAmendmentRow = {
  readonly document_id: string;
  readonly id: string;
};

type OfficeHolderRow = {
  readonly citizen_id: string;
  readonly office_type_id: string;
};

async function getVoteKindDocuments(
  client: GubernatorSupabaseClient,
  {
    nationId,
    settlementId,
  }: { nationId: string | null; settlementId: string | null },
): Promise<
  readonly {
    readonly id: string;
    readonly bodyId: string;
    readonly secondBodyId: string | null;
  }[]
> {
  const query = client
    .from("law_documents")
    .select("amendment_procedure_json,id");
  const { data, error } = await (
    nationId !== null
      ? query.eq("nation_id", nationId)
      : query.eq("settlement_id", settlementId as string)
  ).returns<ScopeDocumentRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  const voteKindDocuments: {
    readonly id: string;
    readonly bodyId: string;
    readonly secondBodyId: string | null;
  }[] = [];

  for (const row of data) {
    let procedure;
    try {
      procedure = validateAmendmentProcedure(row.amendment_procedure_json);
    } catch {
      continue;
    }
    if (procedure.kind === "vote") {
      voteKindDocuments.push({
        bodyId: procedure.bodyId,
        id: row.id,
        secondBodyId: procedure.secondBodyId,
      });
    }
  }

  return voteKindDocuments;
}

async function getProposedAmendments(
  client: GubernatorSupabaseClient,
  documentIds: readonly string[],
): Promise<readonly ProposedAmendmentRow[]> {
  if (documentIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("law_amendments")
    .select("document_id,id")
    .eq("status", "proposed")
    .in("document_id", documentIds)
    .returns<ProposedAmendmentRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

async function getScopeBodies(
  client: GubernatorSupabaseClient,
  {
    nationId,
    settlementId,
  }: { nationId: string | null; settlementId: string | null },
): Promise<ReadonlyMap<string, readonly BodyCompositionRule[]>> {
  const query = client.from("government_bodies").select("composition_json,id");
  const { data, error } = await (
    nationId !== null
      ? query.eq("nation_id", nationId)
      : query.eq("settlement_id", settlementId as string)
  ).returns<{ composition_json: unknown; id: string }[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return new Map(
    data.map((row) => [
      row.id,
      row.composition_json as readonly BodyCompositionRule[],
    ]),
  );
}

async function getScopeResolverContext(
  client: GubernatorSupabaseClient,
  {
    nationId,
    settlementId,
  }: { nationId: string | null; settlementId: string | null },
): Promise<{
  readonly officeHolders: readonly {
    readonly citizenId: string;
    readonly officeTypeId: string;
  }[];
  readonly rulerCitizenId: string | null;
  readonly settlementManagers: readonly {
    readonly citizenId: string;
    readonly settlementId: string;
  }[];
}> {
  const fetchOfficeHolders = async (): Promise<
    readonly { readonly citizenId: string; readonly officeTypeId: string }[]
  > => {
    const officeHoldersQuery = client
      .from("nation_offices")
      .select("citizen_id,office_type_id")
      .is("ended_turn_number", null);
    const officeHoldersResult = await (
      nationId !== null
        ? officeHoldersQuery.eq("nation_id", nationId)
        : officeHoldersQuery.eq("settlement_id", settlementId as string)
    ).returns<OfficeHolderRow[]>();
    if (officeHoldersResult.error !== null) {
      throw normalizeSupabaseError(officeHoldersResult.error);
    }
    return officeHoldersResult.data.map((row) => ({
      citizenId: row.citizen_id,
      officeTypeId: row.office_type_id,
    }));
  };

  const fetchRulerCitizenId = async (): Promise<string | null> => {
    const rulerQuery = client
      .from("citizens")
      .select("id")
      .eq("status", "alive");
    const rulerResult = await (
      nationId !== null
        ? rulerQuery
            .eq("role_type", "nation_manager")
            .eq("role_nation_id", nationId)
        : rulerQuery
            .eq("role_type", "settlement_manager")
            .eq("role_settlement_id", settlementId as string)
    ).maybeSingle<{ id: string }>();
    if (rulerResult.error !== null) {
      throw normalizeSupabaseError(rulerResult.error);
    }
    return rulerResult.data?.id ?? null;
  };

  // Managers depend on the settlement list, so that pair stays chained --
  // but the chain runs alongside the two independent queries above.
  const fetchSettlementManagers = async (): Promise<
    readonly { readonly citizenId: string; readonly settlementId: string }[]
  > => {
    if (nationId === null) {
      return [];
    }
    const settlementsResult = await client
      .from("settlements")
      .select("id")
      .eq("nation_id", nationId)
      .returns<{ id: string }[]>();
    if (settlementsResult.error !== null) {
      throw normalizeSupabaseError(settlementsResult.error);
    }
    const settlementIds = settlementsResult.data.map((row) => row.id);
    if (settlementIds.length === 0) {
      return [];
    }
    const managersResult = await client
      .from("citizens")
      .select("id,role_settlement_id")
      .eq("role_type", "settlement_manager")
      .eq("status", "alive")
      .in("role_settlement_id", settlementIds)
      .returns<{ id: string; role_settlement_id: string }[]>();
    if (managersResult.error !== null) {
      throw normalizeSupabaseError(managersResult.error);
    }
    return managersResult.data.map((row) => ({
      citizenId: row.id,
      settlementId: row.role_settlement_id,
    }));
  };

  const [officeHolders, rulerCitizenId, settlementManagers] = await Promise.all(
    [fetchOfficeHolders(), fetchRulerCitizenId(), fetchSettlementManagers()],
  );

  return {
    officeHolders,
    rulerCitizenId,
    settlementManagers,
  };
}

export async function countLawAmendmentsAwaitingMyVote(
  client: GubernatorSupabaseClient,
  {
    activeCharacterId,
    nationId,
    settlementId,
  }: {
    readonly activeCharacterId: string;
    readonly nationId: string | null;
    readonly settlementId: string | null;
  },
): Promise<number> {
  const voteKindDocuments = await getVoteKindDocuments(client, {
    nationId,
    settlementId,
  });
  if (voteKindDocuments.length === 0) {
    return 0;
  }

  const proposedAmendments = await getProposedAmendments(
    client,
    voteKindDocuments.map((document) => document.id),
  );
  if (proposedAmendments.length === 0) {
    return 0;
  }

  const [bodiesById, resolverContext] = await Promise.all([
    getScopeBodies(client, { nationId, settlementId }),
    getScopeResolverContext(client, { nationId, settlementId }),
  ]);

  // Only the active character's own membership matters here, so the alive
  // set is deliberately just this one citizen -- resolveBodyMembers only
  // reports members present in the alive set, so this collapses "is a
  // resolved member" down to a single boolean per body without resolving
  // (or alive-checking) the rest of the roster.
  const aliveCitizenIds = new Set([activeCharacterId]);
  function isMember(bodyId: string): boolean {
    const composition = bodiesById.get(bodyId);
    if (composition === undefined) {
      return false;
    }
    return resolveBodyMembers(
      { composition },
      { ...resolverContext, aliveCitizenIds },
    ).includes(activeCharacterId);
  }

  const documentById = new Map(
    voteKindDocuments.map((document) => [document.id, document]),
  );
  const eligibleAmendments = proposedAmendments.filter((amendment) => {
    const document = documentById.get(amendment.document_id);
    if (document === undefined) {
      return false;
    }
    return (
      isMember(document.bodyId) ||
      (document.secondBodyId !== null && isMember(document.secondBodyId))
    );
  });
  if (eligibleAmendments.length === 0) {
    return 0;
  }

  const { data: votedRows, error: votedError } = await client
    .from("law_amendment_votes")
    .select("amendment_id")
    .eq("voter_citizen_id", activeCharacterId)
    .in(
      "amendment_id",
      eligibleAmendments.map((amendment) => amendment.id),
    )
    .returns<{ amendment_id: string }[]>();
  if (votedError !== null) {
    throw normalizeSupabaseError(votedError);
  }
  const votedAmendmentIds = new Set(votedRows.map((row) => row.amendment_id));

  return eligibleAmendments.filter(
    (amendment) => !votedAmendmentIds.has(amendment.id),
  ).length;
}

// Only run this (via `enabled`) when the viewer has an active player
// character -- admins with no PC don't get a personal "awaiting your vote"
// badge, per #1120.
export function lawAmendmentsAwaitingMyVoteCountQueryOptions(
  scope: {
    readonly nationId: string | null;
    readonly settlementId: string | null;
  },
  activeCharacterId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  number,
  AuthUiError,
  number,
  ReturnType<typeof lawAmendmentsQueryKeys.awaitingMyVote>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () =>
      countLawAmendmentsAwaitingMyVote(client, {
        activeCharacterId,
        nationId: scope.nationId,
        settlementId: scope.settlementId,
      }),
    queryKey: lawAmendmentsQueryKeys.awaitingMyVote(scope, activeCharacterId),
  });
}
