import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { turnQueryKeys } from "./turnQueryKeys";

// -- Private row types --

type TransitionOutcomeRow = {
  readonly finished_at: string | null;
  readonly from_turn_number: number;
  readonly id: string;
  readonly notifications: NotificationRow[];
  readonly settlement_turn_resource_snapshots: ResourceSnapshotRow[];
  readonly settlement_turn_snapshots: SettlementSnapshotRow[];
  readonly started_at: string;
  readonly status: string;
  readonly to_turn_number: number;
  readonly turn_log_entries: LogEntryRow[];
  readonly world_id: string;
};

type SettlementSnapshotRow = {
  readonly birth_count: number;
  readonly death_count: number;
  readonly homeless_deaths_count: number;
  readonly id: string;
  readonly population_cap: number;
  readonly population_npc: number;
  readonly population_player_character: number;
  readonly population_total: number;
  readonly settlement_id: string;
  readonly starvation_deaths_count: number;
  readonly turn_number: number;
  readonly world_id: string;
};

type ResourceSnapshotRow = {
  readonly consumed_amount: number;
  readonly id: string;
  readonly produced_amount: number;
  readonly quantity_after: number;
  readonly quantity_before: number;
  readonly resource_id: string;
  readonly settlement_id: string;
  readonly trade_in_amount: number;
  readonly trade_out_amount: number;
  readonly turn_number: number;
  readonly world_id: string;
};

type LogEntryRow = {
  readonly citizen_id: string | null;
  readonly id: string;
  readonly log_category: string;
  readonly nation_id: string | null;
  readonly payload_jsonb: unknown;
  readonly resource_id: string | null;
  readonly settlement_id: string | null;
  readonly world_id: string;
};

type NotificationRow = {
  readonly citizen_id: string | null;
  readonly generated_at: string;
  readonly generated_in_transition_id: string | null;
  readonly id: string;
  readonly is_read: boolean;
  readonly message_text: string;
  readonly nation_id: string | null;
  readonly notification_type: string;
  readonly recipient_user_id: string;
  readonly settlement_id: string | null;
  readonly world_id: string;
};

// -- Public domain types --

export type TurnTransitionSettlementSnapshot = {
  readonly birthCount: number;
  readonly deathCount: number;
  readonly homelessDeathsCount: number;
  readonly id: string;
  readonly populationCap: number;
  readonly populationNpc: number;
  readonly populationPlayerCharacter: number;
  readonly populationTotal: number;
  readonly settlementId: string;
  readonly starvationDeathsCount: number;
  readonly turnNumber: number;
  readonly worldId: string;
};

export type TurnTransitionResourceSnapshot = {
  readonly consumedAmount: number;
  readonly id: string;
  readonly producedAmount: number;
  readonly quantityAfter: number;
  readonly quantityBefore: number;
  readonly resourceId: string;
  readonly settlementId: string;
  readonly tradeInAmount: number;
  readonly tradeOutAmount: number;
  readonly turnNumber: number;
  readonly worldId: string;
};

export type TurnTransitionLogEntry = {
  readonly citizenId: string | null;
  readonly id: string;
  readonly logCategory: string;
  readonly nationId: string | null;
  readonly payloadJsonb: unknown;
  readonly resourceId: string | null;
  readonly settlementId: string | null;
  readonly worldId: string;
};

export type TurnTransitionNotification = {
  readonly citizenId: string | null;
  readonly generatedAt: string;
  readonly generatedInTransitionId: string | null;
  readonly id: string;
  readonly isRead: boolean;
  readonly messageText: string;
  readonly nationId: string | null;
  readonly notificationType: string;
  readonly recipientUserId: string;
  readonly settlementId: string | null;
  readonly worldId: string;
};

export type TurnTransitionOutcome = {
  readonly finishedAt: string | null;
  readonly fromTurnNumber: number;
  readonly id: string;
  readonly logEntries: TurnTransitionLogEntry[];
  readonly notifications: TurnTransitionNotification[];
  readonly settlementResourceSnapshots: TurnTransitionResourceSnapshot[];
  readonly settlementSnapshots: TurnTransitionSettlementSnapshot[];
  readonly startedAt: string;
  readonly status: string;
  readonly toTurnNumber: number;
  readonly worldId: string;
};

// -- Select columns --

const TRANSITION_OUTCOME_SELECT = [
  "id",
  "world_id",
  "from_turn_number",
  "to_turn_number",
  "status",
  "started_at",
  "finished_at",
  "settlement_turn_snapshots(id,settlement_id,world_id,turn_number,birth_count,death_count,homeless_deaths_count,starvation_deaths_count,population_cap,population_npc,population_player_character,population_total)",
  "settlement_turn_resource_snapshots(id,settlement_id,world_id,resource_id,turn_number,consumed_amount,produced_amount,quantity_after,quantity_before,trade_in_amount,trade_out_amount)",
  "turn_log_entries(id,settlement_id,world_id,citizen_id,nation_id,resource_id,log_category,payload_jsonb)",
  "notifications(id,settlement_id,world_id,citizen_id,nation_id,generated_at,generated_in_transition_id,is_read,message_text,notification_type,recipient_user_id)",
].join(",");

// -- Query option types --

type LatestWorldTransitionOutcomeQueryKey = ReturnType<
  typeof turnQueryKeys.latestTransitionOutcome
>;
type LatestSettlementTransitionOutcomeQueryKey = ReturnType<
  typeof turnQueryKeys.latestSettlementTransitionOutcome
>;

// -- Query options --

export function latestWorldTransitionOutcomeQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  TurnTransitionOutcome | null,
  Error,
  TurnTransitionOutcome | null,
  LatestWorldTransitionOutcomeQueryKey
> {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getLatestWorldTransitionOutcome(c, worldId),
    queryKey: turnQueryKeys.latestTransitionOutcome(worldId),
  });
}

export function latestSettlementTransitionOutcomeQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  TurnTransitionOutcome | null,
  Error,
  TurnTransitionOutcome | null,
  LatestSettlementTransitionOutcomeQueryKey
> {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getLatestSettlementTransitionOutcome(c, settlementId),
    queryKey: turnQueryKeys.latestSettlementTransitionOutcome(settlementId),
  });
}

// -- Fetchers --

async function getLatestWorldTransitionOutcome(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<TurnTransitionOutcome | null> {
  const { data, error } = await client
    .from("turn_transitions")
    .select(TRANSITION_OUTCOME_SELECT)
    .eq("world_id", worldId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    return null;
  }

  return toTurnTransitionOutcome(data as unknown as TransitionOutcomeRow);
}

async function getLatestSettlementTransitionOutcome(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<TurnTransitionOutcome | null> {
  // settlement_turn_snapshots denormalises the transition link per settlement.
  // Using it avoids a join through nations to reach world_id on settlements.
  const { data: latestSnapshot, error: snapshotError } = await client
    .from("settlement_turn_snapshots")
    .select("turn_transition_id")
    .eq("settlement_id", settlementId)
    .not("turn_transition_id", "is", null)
    .order("turn_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError !== null) {
    throw normalizeSupabaseError(snapshotError);
  }

  if (latestSnapshot === null || latestSnapshot.turn_transition_id === null) {
    return null;
  }

  const { data, error } = await client
    .from("turn_transitions")
    .select(TRANSITION_OUTCOME_SELECT)
    .eq("id", latestSnapshot.turn_transition_id)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    return null;
  }

  const row = data as unknown as TransitionOutcomeRow;

  return toTurnTransitionOutcome({
    ...row,
    notifications: row.notifications.filter(
      (n) => n.settlement_id === settlementId || n.settlement_id === null,
    ),
    settlement_turn_resource_snapshots:
      row.settlement_turn_resource_snapshots.filter(
        (r) => r.settlement_id === settlementId,
      ),
    settlement_turn_snapshots: row.settlement_turn_snapshots.filter(
      (s) => s.settlement_id === settlementId,
    ),
    turn_log_entries: row.turn_log_entries.filter(
      (e) => e.settlement_id === settlementId,
    ),
  });
}

// -- Transformers --

function toTurnTransitionOutcome(
  row: TransitionOutcomeRow,
): TurnTransitionOutcome {
  return {
    finishedAt: row.finished_at,
    fromTurnNumber: row.from_turn_number,
    id: row.id,
    logEntries: row.turn_log_entries.map(toLogEntry),
    notifications: row.notifications.map(toNotification),
    settlementResourceSnapshots:
      row.settlement_turn_resource_snapshots.map(toResourceSnapshot),
    settlementSnapshots:
      row.settlement_turn_snapshots.map(toSettlementSnapshot),
    startedAt: row.started_at,
    status: row.status,
    toTurnNumber: row.to_turn_number,
    worldId: row.world_id,
  };
}

function toSettlementSnapshot(
  row: SettlementSnapshotRow,
): TurnTransitionSettlementSnapshot {
  return {
    birthCount: row.birth_count,
    deathCount: row.death_count,
    homelessDeathsCount: row.homeless_deaths_count,
    id: row.id,
    populationCap: row.population_cap,
    populationNpc: row.population_npc,
    populationPlayerCharacter: row.population_player_character,
    populationTotal: row.population_total,
    settlementId: row.settlement_id,
    starvationDeathsCount: row.starvation_deaths_count,
    turnNumber: row.turn_number,
    worldId: row.world_id,
  };
}

function toResourceSnapshot(
  row: ResourceSnapshotRow,
): TurnTransitionResourceSnapshot {
  return {
    consumedAmount: row.consumed_amount,
    id: row.id,
    producedAmount: row.produced_amount,
    quantityAfter: row.quantity_after,
    quantityBefore: row.quantity_before,
    resourceId: row.resource_id,
    settlementId: row.settlement_id,
    tradeInAmount: row.trade_in_amount,
    tradeOutAmount: row.trade_out_amount,
    turnNumber: row.turn_number,
    worldId: row.world_id,
  };
}

function toLogEntry(row: LogEntryRow): TurnTransitionLogEntry {
  return {
    citizenId: row.citizen_id,
    id: row.id,
    logCategory: row.log_category,
    nationId: row.nation_id,
    payloadJsonb: row.payload_jsonb,
    resourceId: row.resource_id,
    settlementId: row.settlement_id,
    worldId: row.world_id,
  };
}

function toNotification(row: NotificationRow): TurnTransitionNotification {
  return {
    citizenId: row.citizen_id,
    generatedAt: row.generated_at,
    generatedInTransitionId: row.generated_in_transition_id,
    id: row.id,
    isRead: row.is_read,
    messageText: row.message_text,
    nationId: row.nation_id,
    notificationType: row.notification_type,
    recipientUserId: row.recipient_user_id,
    settlementId: row.settlement_id,
    worldId: row.world_id,
  };
}
