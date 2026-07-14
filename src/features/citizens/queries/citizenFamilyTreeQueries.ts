import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import type { PartnershipStatus } from "@/features/partnerships";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { citizensQueryKeys } from "./citizensQueryKeys";

import type {
  FamilyTreeDirection,
  FamilyTreeNode,
} from "../types/citizenTypes";

type FamilyTreeQueryKey = ReturnType<typeof citizensQueryKeys.familyTree>;

type FamilyTreeQueryOptions = UseQueryOptions<
  readonly FamilyTreeNode[],
  AuthUiError,
  readonly FamilyTreeNode[],
  FamilyTreeQueryKey
>;

type FamilyTreeRow = {
  readonly citizen_id: string | null;
  readonly direction: FamilyTreeDirection;
  readonly generation: number;
  readonly name: string | null;
  readonly node_path: string;
  readonly parent_a_citizen_id: string | null;
  readonly parent_b_citizen_id: string | null;
  readonly parent_path: string | null;
  readonly partnership_status: PartnershipStatus | null;
  readonly status: "alive" | "dead" | null;
};

export function citizenFamilyTreeQueryOptions(
  citizenId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): FamilyTreeQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCitizenFamilyTree(client, citizenId),
    queryKey: citizensQueryKeys.familyTree(citizenId),
  });
}

async function getCitizenFamilyTree(
  client: GubernatorSupabaseClient,
  citizenId: string,
): Promise<readonly FamilyTreeNode[]> {
  const { data, error } = await client
    .rpc("get_citizen_family_tree", { p_citizen_id: citizenId })
    .returns<FamilyTreeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return (data ?? []).map(toFamilyTreeNode);
}

function toFamilyTreeNode(row: FamilyTreeRow): FamilyTreeNode {
  return {
    citizenId: row.citizen_id,
    direction: row.direction,
    generation: row.generation,
    name: row.name,
    nodePath: row.node_path,
    parentACitizenId: row.parent_a_citizen_id,
    parentBCitizenId: row.parent_b_citizen_id,
    parentPath: row.parent_path,
    partnershipStatus: row.partnership_status,
    status: row.status,
  };
}
