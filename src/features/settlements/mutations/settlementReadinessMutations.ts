import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import type { WorldPermissionContext } from "@/features/worlds";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { settlementReadinessQueryKeys } from "../queries/settlementReadinessQueryKeys";

type SetSettlementReadinessErrorCode =
  | "settlement_readiness_archived"
  | "settlement_readiness_unauthorized";
type SetSettlementReadinessMutationOptions = UseMutationOptions<
  SettlementReadinessMutationResult,
  AuthUiError | SetSettlementReadinessError,
  SetSettlementReadinessInput
>;
type SettlementReadinessAccessRow = {
  readonly id: string;
  readonly nations: {
    readonly world_id: string;
    readonly worlds: SettlementReadinessWorldAccessRow;
  };
};
type SettlementReadinessWorldAccessRow = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly owner_id: string;
  readonly status: string;
  readonly visibility: string;
};
type SettlementReadinessUpdateRow = {
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly ready_set_at: string | null;
};

export type SetSettlementReadinessInput = {
  readonly isReady: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export type SettlementReadinessMutationResult = {
  readonly id: string;
  readonly isReadyCurrentTurn: boolean;
  readonly readySetAt: string | null;
};

const SETTLEMENT_READINESS_ACCESS_SELECT =
  "id,nations!inner(world_id,worlds!inner(archived_at,id,owner_id,status,visibility))";
const SETTLEMENT_READINESS_UPDATE_SELECT =
  "id,is_ready_current_turn,ready_set_at";
const POSTGRES_CURRENT_TIMESTAMP_INPUT = "now";

export class SetSettlementReadinessError extends Error {
  readonly code: SetSettlementReadinessErrorCode;
  readonly settlementId: string;
  readonly worldId: string;

  constructor({
    code,
    message,
    settlementId,
    worldId,
  }: {
    readonly code: SetSettlementReadinessErrorCode;
    readonly message: string;
    readonly settlementId: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "SetSettlementReadinessError";
    this.code = code;
    this.settlementId = settlementId;
    this.worldId = worldId;
  }
}

export function setSettlementReadinessMutationOptions({
  accessContext,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetSettlementReadinessMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetSettlementReadinessInput) =>
      setSettlementReadiness(client, accessContext, input),
    mutationKey: [...settlementReadinessQueryKeys.all, "set-readiness"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: settlementReadinessQueryKeys.list(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: settlementReadinessQueryKeys.summary(input.worldId),
        }),
      ]);
    },
  });
}

export function isSetSettlementReadinessError(
  error: unknown,
): error is SetSettlementReadinessError {
  return error instanceof SetSettlementReadinessError;
}

async function setSettlementReadiness(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
  input: SetSettlementReadinessInput,
): Promise<SettlementReadinessMutationResult> {
  const accessRow = await getSettlementReadinessAccessRow(client, input);
  const world = accessRow?.nations.worlds ?? null;

  if (
    accessRow === null ||
    world === null ||
    !accessContext.canManageWorld(toWorldAccessTarget(world))
  ) {
    throw new SetSettlementReadinessError({
      code: "settlement_readiness_unauthorized",
      message: "You do not have permission to update this settlement.",
      settlementId: input.settlementId,
      worldId: input.worldId,
    });
  }

  if (world.status === "archived" || world.archived_at !== null) {
    throw new SetSettlementReadinessError({
      code: "settlement_readiness_archived",
      message: "Archived worlds are read-only.",
      settlementId: input.settlementId,
      worldId: input.worldId,
    });
  }

  const { data, error } = await client
    .from("settlements")
    .update({
      is_ready_current_turn: input.isReady,
      ready_set_at: input.isReady ? POSTGRES_CURRENT_TIMESTAMP_INPUT : null,
    })
    .eq("id", input.settlementId)
    .select(SETTLEMENT_READINESS_UPDATE_SELECT)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  if (data === null) {
    throw new SetSettlementReadinessError({
      code: "settlement_readiness_unauthorized",
      message: "Settlement readiness could not be updated.",
      settlementId: input.settlementId,
      worldId: input.worldId,
    });
  }

  return toSettlementReadinessMutationResult(data);
}

async function getSettlementReadinessAccessRow(
  client: GubernatorSupabaseClient,
  input: SetSettlementReadinessInput,
): Promise<SettlementReadinessAccessRow | null> {
  const { data, error } = await client
    .from("settlements")
    .select(SETTLEMENT_READINESS_ACCESS_SELECT)
    .eq("id", input.settlementId)
    .eq("nations.world_id", input.worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data;
}

function toSettlementReadinessMutationResult(
  row: SettlementReadinessUpdateRow,
): SettlementReadinessMutationResult {
  return {
    id: row.id,
    isReadyCurrentTurn: row.is_ready_current_turn,
    readySetAt: row.ready_set_at,
  };
}

function toWorldAccessTarget(world: SettlementReadinessWorldAccessRow): {
  readonly id: string;
  readonly ownerId: string;
  readonly visibility: string;
} {
  return {
    id: world.id,
    ownerId: world.owner_id,
    visibility: world.visibility,
  };
}
