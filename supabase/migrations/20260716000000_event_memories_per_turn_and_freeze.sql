-- Migration: per-turn citizen memories for sustained events + freeze on activation
-- Behaviour change: a citizen receives an event's memory on ANY turn the event
--   is in effect (not only its first activation), so citizens born or migrated
--   into scope mid-event still get it. The partial unique index from
--   20260715000000 (citizen_memories (citizen_id, event_id) where source='event')
--   plus ON CONFLICT DO NOTHING guarantees one memory per (citizen, event), so
--   re-firing each turn never duplicates.
-- Freeze: once an event leaves 'pending' (activates/expires/cancels), its
--   create_citizen_memories flag and memory_text become immutable so the text a
--   citizen received can never diverge from later recipients. Enforced by a
--   BEFORE UPDATE trigger; status/remaining_transitions updates are unaffected.
-- ────────────────────────────────────────────────────────────────────────────
-- ── Helper: fan out memories every in-effect turn (idempotent) ────────────────
create or replace function public.internal_apply_turn_transition_event_patches (
  p_world_id uuid,
  p_transition_id uuid,
  p_to_turn_number integer,
  p_payload jsonb,
  out event_status_update_count integer,
  out citizen_memory_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_patch jsonb;
  v_event_id uuid;
  v_to_status text;
  v_from_status text;
  v_remaining_transitions integer;
  -- event row fields for memory creation
  v_create_citizen_memories boolean;
  v_memory_text text;
  v_scope_type text;
  v_scope_nation_id uuid;
  v_scope_settlement_id uuid;
  v_inserted_count integer;
begin
  event_status_update_count := 0;
  citizen_memory_count      := 0;

  for v_patch in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'eventStatusPatches', '[]'::jsonb))
  loop
    v_event_id             := (v_patch ->> 'eventId')::uuid;
    v_to_status            := v_patch ->> 'toStatus';
    v_from_status          := v_patch ->> 'fromStatus';
    v_remaining_transitions := (v_patch ->> 'remainingTransitions')::integer;

    -- Apply the status + remaining_transitions update
    update public.events
    set
      status                 = v_to_status,
      remaining_transitions  = v_remaining_transitions
    where id = v_event_id
      and world_id = p_world_id;

    event_status_update_count := event_status_update_count + 1;

    -- Fan out memories for every turn the event is in effect (any patch in the
    -- payload means the event was processed this turn). The partial unique index
    -- + ON CONFLICT DO NOTHING make this idempotent: a citizen who already has
    -- this event's memory is skipped, while one newly alive/in-scope this turn
    -- receives it.
    select
      e.create_citizen_memories,
      e.memory_text,
      e.scope_type,
      e.scope_nation_id,
      e.scope_settlement_id
    into
      v_create_citizen_memories,
      v_memory_text,
      v_scope_type,
      v_scope_nation_id,
      v_scope_settlement_id
    from public.events e
    where e.id = v_event_id;

    -- Defensive: never let a blank memory_text abort the turn transition.
    if found
      and v_create_citizen_memories
      and v_memory_text is not null
      and btrim(v_memory_text) <> '' then
      if v_scope_type = 'settlement' then
        insert into public.citizen_memories (
          citizen_id,
          world_id,
          memory_text,
          source,
          event_id,
          occurred_on_turn_number
        )
        select
          c.id,
          c.world_id,
          v_memory_text,
          'event',
          v_event_id,
          p_to_turn_number
        from public.citizens c
        where c.settlement_id = v_scope_settlement_id
          and c.status = 'alive'
        on conflict do nothing;

      elsif v_scope_type = 'nation' then
        insert into public.citizen_memories (
          citizen_id,
          world_id,
          memory_text,
          source,
          event_id,
          occurred_on_turn_number
        )
        select
          c.id,
          c.world_id,
          v_memory_text,
          'event',
          v_event_id,
          p_to_turn_number
        from public.citizens c
        join public.settlements s on s.id = c.settlement_id
        where s.nation_id = v_scope_nation_id
          and c.status = 'alive'
        on conflict do nothing;

      elsif v_scope_type = 'world' then
        insert into public.citizen_memories (
          citizen_id,
          world_id,
          memory_text,
          source,
          event_id,
          occurred_on_turn_number
        )
        select
          c.id,
          c.world_id,
          v_memory_text,
          'event',
          v_event_id,
          p_to_turn_number
        from public.citizens c
        where c.world_id = p_world_id
          and c.status = 'alive'
        on conflict do nothing;
      end if;

      get diagnostics v_inserted_count = row_count;
      citizen_memory_count := citizen_memory_count + v_inserted_count;

      -- Only log turns that actually created memories (avoids a 0-count log
      -- entry every turn for the lifetime of a sustained event).
      if v_inserted_count > 0 then
        insert into public.turn_log_entries (
          turn_transition_id,
          world_id,
          log_category,
          payload_jsonb
        ) values (
          p_transition_id,
          p_world_id,
          'event_memories',
          jsonb_build_object(
            'eventId', v_event_id::text,
            'count',   v_inserted_count
          )
        );
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.internal_apply_turn_transition_event_patches (uuid, uuid, integer, jsonb)
from
  public;

revoke
execute on function public.internal_apply_turn_transition_event_patches (uuid, uuid, integer, jsonb)
from
  anon,
  authenticated;

grant
execute on function public.internal_apply_turn_transition_event_patches (uuid, uuid, integer, jsonb) to service_role;

-- ── Freeze memory config once an event leaves 'pending' ───────────────────────
create or replace function public.internal_freeze_event_memory_after_activation () returns trigger language plpgsql
set
  search_path = '' as $$
begin
  if old.status <> 'pending'
    and (
      new.create_citizen_memories is distinct from old.create_citizen_memories
      or new.memory_text is distinct from old.memory_text
    ) then
    raise exception
      'Cannot change citizen-memory settings once an event has activated'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger events_freeze_memory_after_activation before
update on public.events for each row
execute function public.internal_freeze_event_memory_after_activation ();
