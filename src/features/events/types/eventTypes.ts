/**
 * Event domain types for UI and business logic.
 * These correspond to the event_groups and events DB tables.
 */

export type EventStatus = "pending" | "active" | "expired" | "cancelled";

export type EventScopeType = "world" | "nation" | "settlement";

export type EventDurationType = "instant" | "sustained";

/**
 * Single event row from DB, with all columns.
 */
export type Event = {
  readonly id: string;
  readonly world_id: string;
  readonly event_group_id: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly status: EventStatus;
  readonly effect_type: string;
  readonly effect_payload_jsonb: unknown;
  readonly activate_on_transition_after_turn_number: number;
  readonly scope_type: EventScopeType;
  readonly scope_nation_id: string | null;
  readonly scope_settlement_id: string | null;
  readonly duration_type: EventDurationType;
  readonly duration_transitions: number | null;
  readonly remaining_transitions: number | null;
  readonly job_id: number | null;
  readonly building_blueprint_id: string | null;
  readonly managed_population_type_id: string | null;
  readonly amount_value: string | null;
  readonly multiplier_value: string | null;
  readonly extra_data_jsonb: unknown;
  readonly create_citizen_memories: boolean;
  readonly memory_text: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/**
 * Event group row — narrative grouping for multi-target events.
 */
export type EventGroup = {
  readonly id: string;
  readonly world_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly created_during_turn_number: number;
  readonly created_by_user_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/**
 * Enriched event with related group info.
 */
export type EventWithGroup = {
  readonly group?: EventGroup | null;
} & Event;

/**
 * Event with its effects.
 */
export type EventWithEffects = Event & {
  readonly effects: readonly EventEffect[];
};

/**
 * Summary of an event for detail view.
 */
export type EventDetail = {
  readonly id: string;
  readonly name: string;
  readonly status: EventStatus;
  readonly effectType: string;
  readonly scopeType: EventScopeType;
  readonly durationType: EventDurationType;
  readonly remainingTransitions: number | null;
  readonly durationTransitions: number | null;
  readonly activationTurn: number;
  readonly memoryText: string | null;
};

/**
 * Single event effect from DB.
 */
export type EventEffect = {
  readonly id: string;
  readonly event_id: string;
  readonly effect_type: string;
  readonly amount_value: number | null;
  readonly multiplier_value: number | null;
  readonly is_percent: boolean;
  readonly resource_id: string | null;
  readonly job_id: string | null;
  readonly managed_population_instance_id: string | null;
  readonly managed_population_type_id: string | null;
  readonly deposit_instance_id: string | null;
  readonly settlement_building_id: string | null;
  readonly extra_data_jsonb: unknown;
  readonly created_at: string;
  readonly updated_at: string;
};

/**
 * Filter state for events list.
 */
export type EventListFilters = {
  readonly statusFilter?: EventStatus[];
  readonly scopeFilter?: EventScopeType[];
  readonly effectTypeFilter?: string[];
};
