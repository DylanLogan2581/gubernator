import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { BodyCompositionRule } from "@/shared/government";

import { governmentBodiesQueryKeys } from "./governmentBodiesQueryKeys";

import type {
  BodyResolverContext,
  GovernmentBody,
} from "../types/governmentBodyTypes";

const GOVERNMENT_BODY_SELECT =
  "id,world_id,nation_id,settlement_id,name,description,composition_json,created_at,updated_at";

type GovernmentBodyRow = {
  readonly composition_json: unknown;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nation_id: string | null;
  readonly settlement_id: string | null;
  readonly updated_at: string;
  readonly world_id: string;
};

function toGovernmentBody(row: GovernmentBodyRow): GovernmentBody {
  return {
    composition: row.composition_json as readonly BodyCompositionRule[],
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    name: row.name,
    nationId: row.nation_id,
    settlementId: row.settlement_id,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}

type GovernmentBodyListQueryOptions = UseQueryOptions<
  readonly GovernmentBody[],
  AuthUiError,
  readonly GovernmentBody[],
  ReturnType<typeof governmentBodiesQueryKeys.nationList>
>;

export function nationGovernmentBodiesQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): GovernmentBodyListQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationGovernmentBodies(client, nationId),
    queryKey: governmentBodiesQueryKeys.nationList(nationId),
  });
}

async function getNationGovernmentBodies(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly GovernmentBody[]> {
  const { data, error } = await client
    .from("government_bodies")
    .select(GOVERNMENT_BODY_SELECT)
    .eq("nation_id", nationId)
    .order("name")
    .returns<GovernmentBodyRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toGovernmentBody);
}

export function settlementGovernmentBodiesQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  readonly GovernmentBody[],
  AuthUiError,
  readonly GovernmentBody[],
  ReturnType<typeof governmentBodiesQueryKeys.settlementList>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementGovernmentBodies(client, settlementId),
    queryKey: governmentBodiesQueryKeys.settlementList(settlementId),
  });
}

async function getSettlementGovernmentBodies(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly GovernmentBody[]> {
  const { data, error } = await client
    .from("government_bodies")
    .select(GOVERNMENT_BODY_SELECT)
    .eq("settlement_id", settlementId)
    .order("name")
    .returns<GovernmentBodyRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toGovernmentBody);
}

type BodyResolverContextQueryOptions<TKey extends readonly unknown[]> =
  UseQueryOptions<BodyResolverContext, AuthUiError, BodyResolverContext, TKey>;

// Supporting data for resolveBodyMembers (src/shared/government): every
// nation_offices holder of this nation, the nation manager (ruler), and the
// settlement manager of every settlement in the nation.
export function nationBodyResolverContextQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): BodyResolverContextQueryOptions<
  ReturnType<typeof governmentBodiesQueryKeys.nationResolverContext>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationBodyResolverContext(client, nationId),
    queryKey: governmentBodiesQueryKeys.nationResolverContext(nationId),
  });
}

async function getNationBodyResolverContext(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<BodyResolverContext> {
  const [officeHoldersResult, rulerResult, settlementsResult] =
    await Promise.all([
      client
        .from("nation_offices")
        .select("citizen_id,office_type_id")
        .eq("nation_id", nationId)
        .returns<{ citizen_id: string; office_type_id: string }[]>(),
      client
        .from("citizens")
        .select("id")
        .eq("role_type", "nation_manager")
        .eq("role_nation_id", nationId)
        .eq("status", "alive")
        .maybeSingle<{ id: string }>(),
      client.from("settlements").select("id").eq("nation_id", nationId),
    ]);

  if (officeHoldersResult.error !== null) {
    throw normalizeSupabaseError(officeHoldersResult.error);
  }
  if (rulerResult.error !== null) {
    throw normalizeSupabaseError(rulerResult.error);
  }
  if (settlementsResult.error !== null) {
    throw normalizeSupabaseError(settlementsResult.error);
  }

  const settlementIds = (
    settlementsResult.data as readonly { id: string }[]
  ).map((row) => row.id);

  let settlementManagerCitizenIds: readonly string[] = [];
  if (settlementIds.length > 0) {
    const { data, error } = await client
      .from("citizens")
      .select("id")
      .eq("role_type", "settlement_manager")
      .eq("status", "alive")
      .in("role_settlement_id", settlementIds)
      .returns<{ id: string }[]>();

    if (error !== null) {
      throw normalizeSupabaseError(error);
    }
    settlementManagerCitizenIds = data.map((row) => row.id);
  }

  return {
    officeHolders: officeHoldersResult.data.map((row) => ({
      citizenId: row.citizen_id,
      officeTypeId: row.office_type_id,
    })),
    rulerCitizenId: rulerResult.data?.id ?? null,
    settlementManagerCitizenIds,
  };
}

// Supporting data for resolveBodyMembers, settlement scope: every
// nation_offices holder of this settlement and the settlement manager
// (ruler). Settlement bodies have no settlement_managers-of-a-nation notion.
export function settlementBodyResolverContextQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): BodyResolverContextQueryOptions<
  ReturnType<typeof governmentBodiesQueryKeys.settlementResolverContext>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementBodyResolverContext(client, settlementId),
    queryKey: governmentBodiesQueryKeys.settlementResolverContext(settlementId),
  });
}

async function getSettlementBodyResolverContext(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<BodyResolverContext> {
  const [officeHoldersResult, rulerResult] = await Promise.all([
    client
      .from("nation_offices")
      .select("citizen_id,office_type_id")
      .eq("settlement_id", settlementId)
      .returns<{ citizen_id: string; office_type_id: string }[]>(),
    client
      .from("citizens")
      .select("id")
      .eq("role_type", "settlement_manager")
      .eq("role_settlement_id", settlementId)
      .eq("status", "alive")
      .maybeSingle<{ id: string }>(),
  ]);

  if (officeHoldersResult.error !== null) {
    throw normalizeSupabaseError(officeHoldersResult.error);
  }
  if (rulerResult.error !== null) {
    throw normalizeSupabaseError(rulerResult.error);
  }

  return {
    officeHolders: officeHoldersResult.data.map((row) => ({
      citizenId: row.citizen_id,
      officeTypeId: row.office_type_id,
    })),
    rulerCitizenId: rulerResult.data?.id ?? null,
    settlementManagerCitizenIds: [],
  };
}
