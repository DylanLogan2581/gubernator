// See src/features/settlements/utils/settlementReadinessState.ts for the settlement
// readiness state machine: legal (autoReadyEnabled, isReadyCurrentTurn) combinations,
// named UI states, and legal transitions.

import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { toWorldAccessTarget } from "@/features/permissions";
import type { WorldPermissionContext } from "@/features/worlds";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { settlementReadinessQueryKeys } from "../queries/settlementReadinessQueryKeys";
import { deriveSettlementReadinessState } from "../utils/settlementReadinessState";

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
  readonly status: string;
  readonly visibility: string;
};
type SettlementReadinessUpdateRow = {
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly last_ready_at: string | null;
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
  "id,nations!inner(world_id,worlds!inner(archived_at,id,status,visibility))";

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

// Planned for use in settlement readiness UI error handling (not yet wired to a component).
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
  _accessContext: WorldPermissionContext,
  input: SetSettlementReadinessInput,
): Promise<SettlementReadinessMutationResult> {
  const accessRow = await getSettlementReadinessAccessRow(client, input);
  const world = accessRow?.nations.worlds ?? null;

  if (accessRow === null || world === null) {
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
    .rpc("set_settlement_readiness", {
      p_is_ready: input.isReady,
      p_settlement_id: input.settlementId,
    })
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
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
    .rpc("set_settlement_auto_ready", {
      p_auto_ready_enabled: input.autoReadyEnabled,
      p_settlement_id: input.settlementId,
    })
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
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
    throw normalizeSupabaseError(error);
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
  const { isReadyForCurrentTurn } = deriveSettlementReadinessState({
    autoReadyEnabled: row.auto_ready_enabled,
    isReadyCurrentTurn: row.is_ready_current_turn,
  });
  return {
    autoReadyEnabled: row.auto_ready_enabled,
    id: row.id,
    isReadyCurrentTurn: row.is_ready_current_turn,
    isReadyForCurrentTurn,
    readySetAt: row.ready_set_at,
  };
}
