import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldNamingConfigSchema } from "@/lib/worldNamingConfigSchemas";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";
import type { Json } from "@/types/database";

import { namesetsQueryKeys } from "./namesetsQueryKeys";

import type { Nameset } from "../types/namesetTypes";

const NAMESET_SELECT =
  "id,world_id,name,config_json,is_default,is_trashed,created_at,updated_at";

type NamesetRow = {
  readonly id: string;
  readonly world_id: string;
  readonly name: string;
  readonly config_json: Json;
  readonly is_default: boolean;
  readonly is_trashed: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

function toNameset(row: NamesetRow): Nameset {
  const configResult = worldNamingConfigSchema.safeParse(row.config_json);
  return {
    id: row.id,
    worldId: row.world_id,
    name: row.name,
    configJson: configResult.success
      ? configResult.data
      : {
          convention: "random",
          female_given_names: [],
          male_given_names: [],
          surnames: [],
        },
    isDefault: row.is_default,
    isTrashed: row.is_trashed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type NamesetsByWorldQueryKey = ReturnType<typeof namesetsQueryKeys.byWorld>;
type ActiveNamesetsByWorldQueryKey = ReturnType<
  typeof namesetsQueryKeys.activeByWorld
>;

type NamesetsByWorldQueryOptions = UseQueryOptions<
  readonly Nameset[],
  AuthUiError,
  readonly Nameset[],
  NamesetsByWorldQueryKey
>;
type ActiveNamesetsByWorldQueryOptions = UseQueryOptions<
  readonly Nameset[],
  AuthUiError,
  readonly Nameset[],
  ActiveNamesetsByWorldQueryKey
>;

export function namesetsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NamesetsByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getNamesetsByWorld(c, worldId),
    queryKey: namesetsQueryKeys.byWorld(worldId),
  });
}

export function activeNamesetsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActiveNamesetsByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getActiveNamesetsByWorld(c, worldId),
    queryKey: namesetsQueryKeys.activeByWorld(worldId),
  });
}

async function getNamesetsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly Nameset[]> {
  const { data, error } = await client
    .from("namesets")
    .select(NAMESET_SELECT)
    .eq("world_id", worldId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<NamesetRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toNameset);
}

async function getActiveNamesetsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly Nameset[]> {
  const { data, error } = await client
    .from("namesets")
    .select(NAMESET_SELECT)
    .eq("world_id", worldId)
    .eq("is_trashed", false)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<NamesetRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toNameset);
}

export type { NamesetRow };
export { toNameset, NAMESET_SELECT };
