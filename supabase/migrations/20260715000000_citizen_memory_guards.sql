-- Migration: citizen memory guards
-- Fix 1: forbid create_citizen_memories=true without usable memory_text.
--   citizen_memories.memory_text is NOT NULL + length>=1, so a blank-text event
--   with the flag on would throw inside apply_turn_transition and roll back the
--   whole turn. Sanitize existing offenders, then enforce with a table CHECK.
-- Fix 2: make event-sourced memory fan-out idempotent — one memory per
--   (citizen, event) — so retries / re-applied patches never duplicate.
-- ────────────────────────────────────────────────────────────────────────────
-- ── Fix 1: sanitize existing broken rows, then enforce the invariant ──────────
update public.events
set
  create_citizen_memories = false
where
  create_citizen_memories = true
  and (
    memory_text is null
    or btrim(memory_text) = ''
  );

alter table public.events
add constraint events_memory_text_required_check check (
  not create_citizen_memories
  or (
    memory_text is not null
    and char_length(btrim(memory_text)) >= 1
  )
);

-- ── Fix 2: dedupe pre-existing event memories, then add the unique index ──────
delete from public.citizen_memories a using public.citizen_memories b
where
  a.source = 'event'
  and b.source = 'event'
  and a.event_id is not null
  and a.citizen_id = b.citizen_id
  and a.event_id = b.event_id
  and a.ctid > b.ctid;

create unique index citizen_memories_event_dedup_idx on public.citizen_memories (citizen_id, event_id)
where
  source = 'event'
  and event_id is not null;

-- ── Redefine helper: defensive blank-text guard + idempotent inserts ──────────
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

    -- On first activation (fromStatus = 'pending'), optionally fan out memories
    if v_from_status = 'pending' then
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
      -- The events_memory_text_required_check CHECK should prevent this, but a
      -- direct table write could bypass it; skip rather than throw.
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
