-- Migration: set-based citizen/partnership patches in the turn write path
--
-- Phase 2 of the DB scaling roadmap (issue #1271).
--
-- internal_apply_turn_transition_citizen_partnership_patches previously looped
-- over every element of five payload arrays, running one or more statements per
-- element. On a large world a single turn can carry hundreds of births, deaths,
-- partnership changes and assignment clears, so statement count scaled linearly
-- with population churn.
--
-- Rebased on the 20261128 definition, whose overshoot stamp also backfills
-- from_turn_number/to_turn_number; that statement was already set-based and is
-- carried over unchanged.
--
-- This rewrites four of the five loops as bounded, set-based statements over
-- jsonb_to_recordset(...):
--   * bornOnTurnBackfill  -> one UPDATE public.citizens ... FROM (...)
--   * citizenDeaths       -> one guard SELECT + one UPDATE public.citizens
--   * partnershipChanges  -> one guard SELECT + one UPDATE (terminal statuses)
--                            + one INSERT (formations)
--   * assignmentClears    -> one DELETE ... USING (...)
--
-- citizenBirths stays row-by-row: create_citizen_internal generates the citizen
-- id in SQL (the payload carries no id) and performs heredity/nameset resolution
-- plus multiple dependent inserts per birth, so a set-based rewrite cannot
-- preserve exact per-birth semantics without a much larger change.
--
-- Behaviour is preserved exactly, including:
--   * every out-parameter count is the number of payload elements processed
--     (not the number of rows actually touched), as before,
--   * the same P0001 errors with the same messages for a missing citizen, a
--     player-character death, a partnership formed with a dead/missing citizen
--     and a terminal change with no matching active partnership -- reported for
--     the first offending payload element in payload order (and, within a
--     formation entry, partner A before partner B), matching the old loop,
--   * duplicate entries for the same citizen resolve last-wins, matching the
--     old loop's repeated updates,
--   * terminal partnership changes are applied before formations, so ending and
--     re-forming the same pair in one payload behaves as it did row-by-row.
--
-- RLS: none (function is security definer, unchanged grants).
-- DB test: yes (apply_turn_transition_citizen_partnership_patches_test.sql).
-- Typegen: none (signature unchanged, no new public helper).
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_citizen_partnership_patches (
  p_world_id uuid,
  p_transition_id uuid,
  p_payload jsonb,
  out backfill_count integer,
  out citizen_birth_count integer,
  out citizen_death_count integer,
  out partnership_change_count integer,
  out assignment_clear_count integer,
  out overshoot_stamp_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_backfills           jsonb := coalesce(p_payload -> 'bornOnTurnBackfill', '[]'::jsonb);
  v_births              jsonb := coalesce(p_payload -> 'citizenBirths', '[]'::jsonb);
  v_deaths              jsonb := coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb);
  v_partnership_changes jsonb := coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb);
  v_assignment_clears   jsonb := coalesce(p_payload -> 'assignmentClears', '[]'::jsonb);
  v_birth jsonb;
  v_citizen_id uuid;
  v_partner_a_id uuid;
  v_partner_b_id uuid;
  v_violation text;
  v_from_turn_number integer;
  v_to_turn_number integer;
begin
  backfill_count           := coalesce(jsonb_array_length(v_backfills), 0);
  citizen_birth_count      := 0;
  citizen_death_count      := coalesce(jsonb_array_length(v_deaths), 0);
  partnership_change_count := coalesce(jsonb_array_length(v_partnership_changes), 0);
  assignment_clear_count   := coalesce(jsonb_array_length(v_assignment_clears), 0);
  overshoot_stamp_count    := 0;

  if backfill_count > 0 then
    -- Last entry for a citizen wins, matching the old loop's repeated updates.
    update public.citizens c
    set
      born_on_turn_number = b.born_on_turn_number
    from (
      select distinct on (r.citizen_id)
        r.citizen_id,
        r.born_on_turn_number
      from
        rows from (
          jsonb_to_recordset(v_backfills) as (
            "citizenId" uuid,
            "bornOnTurnNumber" integer
          )
        ) with ordinality as r (citizen_id, born_on_turn_number, ord)
      order by r.citizen_id, r.ord desc
    ) as b
    where c.id = b.citizen_id;
  end if;

  -- Birth payloads now carry givenName/surname. Keep name as a compatibility
  -- fallback for older focused pgTAP fixtures. Kept row-by-row: see the header.
  for v_birth in
    select value
    from jsonb_array_elements(v_births)
  loop
    perform public.create_citizen_internal (
      p_world_id,
      (v_birth ->> 'settlementId')::uuid,
      'npc',
      coalesce(v_birth ->> 'givenName', v_birth ->> 'name'),
      v_birth ->> 'surname',
      v_birth ->> 'sex',
      null,
      (v_birth ->> 'bornOnTurnNumber')::integer,
      (v_birth ->> 'parentACitizenId')::uuid,
      (v_birth ->> 'parentBCitizenId')::uuid,
      null,
      null,
      null,
      v_birth ->> 'npcTrait1',
      v_birth ->> 'npcTrait2',
      v_birth ->> 'npcSecretContradiction',
      v_birth ->> 'npcGoal',
      v_birth ->> 'npcFlaw',
      (v_birth ->> 'namesetId')::uuid,
      (v_birth ->> 'cultureId')::uuid,
      (v_birth ->> 'religionId')::uuid,
      (v_birth ->> 'educationLevelId')::uuid
    );

    citizen_birth_count := citizen_birth_count + 1;
  end loop;

  if citizen_death_count > 0 then
    -- Guard first, reporting the first offending element in payload order so the
    -- raised message matches the old row-by-row loop.
    select
      case when c.id is null then 'missing' else 'player_character' end,
      d.citizen_id
    into v_violation, v_citizen_id
    from
      rows from (
        jsonb_to_recordset(v_deaths) as ("citizenId" uuid)
      ) with ordinality as d (citizen_id, ord)
      left join public.citizens c on c.id = d.citizen_id
    where c.id is null or c.citizen_type = 'player_character'
    order by d.ord
    limit 1;

    if v_violation = 'missing' then
      raise exception 'citizen % not found', v_citizen_id using errcode = 'P0001';
    elsif v_violation = 'player_character' then
      raise exception 'simulation engine may not kill a player character (citizen %)', v_citizen_id
        using errcode = 'P0001';
    end if;

    -- Issue #1078: a dead citizen can no longer hold a manager role. Clearing
    -- it here (rather than leaving it to be resolved out-of-band) makes the
    -- nation/settlement manager-vacant the instant the transition applies,
    -- which is what nation_readiness_eligible_voter_ids and every recipient
    -- query in this module already assume ("status = 'alive'" is checked
    -- everywhere a role is used for authority or notification fan-out -- the
    -- role itself lingering past death was the actual gap, not those checks).
    update public.citizens c
    set
      status               = 'dead',
      death_cause_category = d.death_cause_category,
      death_cause          = d.death_cause,
      role_type            = 'none',
      role_nation_id       = null,
      role_settlement_id   = null
    from (
      select distinct on (r.citizen_id)
        r.citizen_id,
        r.death_cause_category,
        r.death_cause
      from
        rows from (
          jsonb_to_recordset(v_deaths) as (
            "citizenId" uuid,
            "deathCauseCategory" public.death_cause_category,
            "deathCause" text
          )
        ) with ordinality as r (citizen_id, death_cause_category, death_cause, ord)
      order by r.citizen_id, r.ord desc
    ) as d
    where c.id = d.citizen_id;
  end if;

  if partnership_change_count > 0 then
    -- Formation guard: partner A is checked before partner B within an entry,
    -- and entries are checked in payload order, matching the old loop.
    with parsed_changes as (
      select
        r.citizen_a_id,
        r.citizen_b_id,
        r.to_status,
        r.ord
      from
        rows from (
          jsonb_to_recordset(v_partnership_changes) as (
            "citizenAId" uuid,
            "citizenBId" uuid,
            "toStatus" text
          )
        ) with ordinality as r (citizen_a_id, citizen_b_id, to_status, ord)
      where r.to_status = 'active'
    ),
    partners as (
      select r.ord, r.citizen_a_id as partner_id, 1 as slot from parsed_changes r
      union all
      select r.ord, r.citizen_b_id, 2 from parsed_changes r
    )
    select
      case when c.id is null then 'missing' else 'dead' end,
      f.partner_id
    into v_violation, v_citizen_id
    from partners f
      left join public.citizens c on c.id = f.partner_id
    where c.id is null or c.status = 'dead'
    order by f.ord, f.slot
    limit 1;

    if v_violation = 'missing' then
      raise exception 'citizen % not found', v_citizen_id using errcode = 'P0001';
    elsif v_violation = 'dead' then
      raise exception 'simulation engine may not form a partnership with a dead citizen (citizen %)', v_citizen_id
        using errcode = 'P0001';
    end if;

    -- Terminal-status guard: every non-'active' entry must match an existing
    -- active partnership between the two citizens (either column order).
    select e.citizen_a_id, e.citizen_b_id
    into v_partner_a_id, v_partner_b_id
    from
      rows from (
        jsonb_to_recordset(v_partnership_changes) as (
          "citizenAId" uuid,
          "citizenBId" uuid,
          "toStatus" text
        )
      ) with ordinality as e (citizen_a_id, citizen_b_id, to_status, ord)
    where e.to_status is distinct from 'active'
      and not exists (
        select 1
        from public.partnerships p
        where p.status = 'active'
          and (
            (p.citizen_a_id = e.citizen_a_id and p.citizen_b_id = e.citizen_b_id)
            or (p.citizen_a_id = e.citizen_b_id and p.citizen_b_id = e.citizen_a_id)
          )
      )
    order by e.ord
    limit 1;

    if found then
      raise exception 'active partnership between % and % not found', v_partner_a_id, v_partner_b_id
        using errcode = 'P0001';
    end if;

    -- Terminal statuses first, so ending and re-forming the same pair in one
    -- payload still ends the old row before the new active row is inserted.
    update public.partnerships p
    set
      status               = e.to_status,
      ended_on_turn_number = e.ended_on_turn_number
    from
      rows from (
        jsonb_to_recordset(v_partnership_changes) as (
          "citizenAId" uuid,
          "citizenBId" uuid,
          "toStatus" text,
          "endedOnTurnNumber" integer
        )
      ) as e (citizen_a_id, citizen_b_id, to_status, ended_on_turn_number)
    where p.status = 'active'
      and e.to_status is distinct from 'active'
      and (
        (p.citizen_a_id = e.citizen_a_id and p.citizen_b_id = e.citizen_b_id)
        or (p.citizen_a_id = e.citizen_b_id and p.citizen_b_id = e.citizen_a_id)
      );

    insert into public.partnerships (
      citizen_a_id,
      citizen_b_id,
      status,
      formed_on_turn_number
    )
    select
      e.citizen_a_id,
      e.citizen_b_id,
      'active',
      e.formed_on_turn_number
    from
      rows from (
        jsonb_to_recordset(v_partnership_changes) as (
          "citizenAId" uuid,
          "citizenBId" uuid,
          "toStatus" text,
          "formedOnTurnNumber" integer
        )
      ) with ordinality as e (
        citizen_a_id,
        citizen_b_id,
        to_status,
        formed_on_turn_number,
        ord
      )
    where e.to_status = 'active'
    order by e.ord;
  end if;

  if assignment_clear_count > 0 then
    delete from public.citizen_assignments ca using (
      select distinct r.citizen_id
      from
        rows from (
          jsonb_to_recordset(v_assignment_clears) as ("citizenId" uuid)
        ) as r (citizen_id)
    ) as a
    where ca.citizen_id = a.citizen_id;
  end if;

  select from_turn_number, to_turn_number
  into v_from_turn_number, v_to_turn_number
  from public.turn_transitions
  where id = p_transition_id;

  update public.turn_log_entries
  set
    turn_transition_id = p_transition_id,
    from_turn_number = v_from_turn_number,
    to_turn_number = v_to_turn_number
  where
    world_id = p_world_id
    and log_category = 'manual_deconstruct_overshoot'
    and turn_transition_id is null;

  get diagnostics overshoot_stamp_count = row_count;
end;
$$;

revoke all on function public.internal_apply_turn_transition_citizen_partnership_patches (uuid, uuid, jsonb)
from
  public,
  anon,
  authenticated;
