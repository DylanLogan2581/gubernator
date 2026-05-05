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
type SetSettlementAutoReadyErrorCode =
  | "settlement_auto_ready_archived"
  | "settlement_auto_ready_unauthorized";
type SetSettlementReadinessMutationOptions = UseMutationOptions<
  SettlementReadinessMutationResult,
  AuthUiError | SetSettlementReadinessError,
  SetSettlementReadinessInput
>;
type SetSettlementAutoReadyMutationOptions = UseMutationOptions<
  SettlementAutoReadyMutationResult,
  AuthUiError | SetSettlementAutoReadyError,
  SetSettlementAutoReadyInput
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
type SettlementAutoReadyUpdateRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly ready_set_at: string | null;
};

export type SetSettlementReadinessInput = {
  readonly isReady: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export type SetSettlementAutoReadyInput = {
  readonly autoReadyEnabled: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

export type SettlementReadinessMutationResult = {
  readonly id: string;
  readonly isReadyCurrentTurn: boolean;
  readonly readySetAt: string | null;
};

export type SettlementAutoReadyMutationResult = {
  readonly autoReadyEnabled: boolean;
  readonly id: string;
  readonly isReadyCurrentTurn: boolean;
  readonly isReadyForCurrentTurn: boolean;
  readonly readySetAt: string | null;
};

const SETTLEMENT_READINESS_ACCESS_SELECT =
  "id,nations!inner(world_id,worlds!inner(archived_at,id,owner_id,status,visibility))";
const SETTLEMENT_READINESS_UPDATE_SELECT =
  "id,is_ready_current_turn,ready_set_at";
const SETTLEMENT_AUTO_READY_UPDATE_SELECT =
  "id,auto_ready_enabled,is_ready_current_turn,ready_set_at";
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

export class SetSettlementAutoReadyError extends Error {
  readonly code: SetSettlementAutoReadyErrorCode;
  readonly settlementId: string;
  readonly worldId: string;

  constructor({
    code,
    message,
    settlementId,
    worldId,
  }: {
    readonly code: SetSettlementAutoReadyErrorCode;
    readonly message: string;
    readonly settlementId: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "SetSettlementAutoReadyError";
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

export function setSettlementAutoReadyMutationOptions({
  accessContext,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetSettlementAutoReadyMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetSettlementAutoReadyInput) =>
      setSettlementAutoReady(client, accessContext, input),
    mutationKey: [...settlementReadinessQueryKeys.all, "set-auto-ready"],
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

export function isSetSettlementAutoReadyError(
  error: unknown,
): error is SetSettlementAutoReadyError {
  return error instanceof SetSettlementAutoReadyError;
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
      ...(input.isReady
        ? { last_ready_at: POSTGRES_CURRENT_TIMESTAMP_INPUT }
        : {}),
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

async function setSettlementAutoReady(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
  input: SetSettlementAutoReadyInput,
): Promise<SettlementAutoReadyMutationResult> {
  const accessRow = await getSettlementReadinessAccessRow(client, input);
  const world = accessRow?.nations.worlds ?? null;

  if (
    accessRow === null ||
    world === null ||
    !accessContext.canAdminWorld(toWorldAccessTarget(world))
  ) {
    throw new SetSettlementAutoReadyError({
      code: "settlement_auto_ready_unauthorized",
      message: "You do not have permission to update auto-ready.",
      settlementId: input.settlementId,
      worldId: input.worldId,
    });
  }

  if (world.status === "archived" || world.archived_at !== null) {
    throw new SetSettlementAutoReadyError({
      code: "settlement_auto_ready_archived",
      message: "Archived worlds are read-only.",
      settlementId: input.settlementId,
      worldId: input.worldId,
    });
  }

  const { data, error } = await client
    .from("settlements")
    .update({ auto_ready_enabled: input.autoReadyEnabled })
    .eq("id", input.settlementId)
    .select(SETTLEMENT_AUTO_READY_UPDATE_SELECT)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  if (data === null) {
    throw new SetSettlementAutoReadyError({
      code: "settlement_auto_ready_unauthorized",
      message: "Auto-ready could not be updated.",
      settlementId: input.settlementId,
      worldId: input.worldId,
    });
  }

  return toSettlementAutoReadyMutationResult(data);
}

async function getSettlementReadinessAccessRow(
  client: GubernatorSupabaseClient,
  input: {
    readonly settlementId: string;
    readonly worldId: string;
  },
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

function toSettlementAutoReadyMutationResult(
  row: SettlementAutoReadyUpdateRow,
): SettlementAutoReadyMutationResult {
  return {
    autoReadyEnabled: row.auto_ready_enabled,
    id: row.id,
    isReadyCurrentTurn: row.is_ready_current_turn,
    isReadyForCurrentTurn: row.auto_ready_enabled || row.is_ready_current_turn,
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
