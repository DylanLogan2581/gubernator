-- Migration: fix_apply_turn_transition_birth_surname_helper
-- Keeps the refactored apply_turn_transition helper in sync with the
-- create_citizen_internal given_name/surname signature.
create or replace function public.create_citizen_internal (
  p_world_id uuid,
  p_settlement_id uuid,
  p_citizen_type text,
  p_given_name text,
  p_surname text DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_born_on_turn_number integer DEFAULT NULL,
  p_parent_a_citizen_id uuid DEFAULT NULL,
  p_parent_b_citizen_id uuid DEFAULT NULL,
  p_personality_text text DEFAULT NULL,
  p_skills_text text DEFAULT NULL,
  p_profile_photo_url text DEFAULT NULL,
  p_npc_trait_1 text DEFAULT NULL,
  p_npc_trait_2 text DEFAULT NULL,
  p_npc_secret_contradiction text DEFAULT NULL,
  p_npc_goal text DEFAULT NULL,
  p_npc_flaw text DEFAULT NULL
) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_world_archived_at timestamptz;
  v_world_incest_depth integer;
  v_parent_a_world_id uuid;
  v_parent_b_world_id uuid;
  v_settlement_world_id uuid;
begin
  if p_world_id is null or p_given_name is null then
    return;
  end if;

  if p_citizen_type not in ('npc', 'player_character') then
    return;
  end if;

  if p_citizen_type = 'player_character' and p_user_id is null then
    return;
  end if;

  if p_citizen_type = 'npc' and p_user_id is not null then
    return;
  end if;

  if char_length(btrim(p_given_name)) = 0 then
    return;
  end if;

  if p_parent_a_citizen_id is not null
     and p_parent_b_citizen_id is not null
     and p_parent_a_citizen_id = p_parent_b_citizen_id then
    return;
  end if;

  if coalesce(current_setting('role', true), '') <> 'service_role'
     and not (
       public.is_super_admin ()
       or public.is_world_admin (p_world_id)
     ) then
    return;
  end if;

  select w.status, w.archived_at, w.incest_prevention_depth
  into v_world_status, v_world_archived_at, v_world_incest_depth
  from public.worlds w
  where w.id = p_world_id;

  if v_world_status is null then
    return;
  end if;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    return;
  end if;

  if p_settlement_id is not null then
    select n.world_id into v_settlement_world_id
    from public.settlements s
    inner join public.nations n on n.id = s.nation_id
    where s.id = p_settlement_id;

    if v_settlement_world_id is null or v_settlement_world_id <> p_world_id then
      return;
    end if;
  end if;

  if p_parent_a_citizen_id is not null then
    select c.world_id into v_parent_a_world_id
    from public.citizens c
    where c.id = p_parent_a_citizen_id;

    if v_parent_a_world_id is null or v_parent_a_world_id <> p_world_id then
      return;
    end if;
  end if;

  if p_parent_b_citizen_id is not null then
    select c.world_id into v_parent_b_world_id
    from public.citizens c
    where c.id = p_parent_b_citizen_id;

    if v_parent_b_world_id is null or v_parent_b_world_id <> p_world_id then
      return;
    end if;
  end if;

  if p_user_id is not null then
    if not exists (
      select 1 from public.users u where u.id = p_user_id
    ) then
      return;
    end if;
  end if;

  if p_parent_a_citizen_id is not null
     and p_parent_b_citizen_id is not null
     and coalesce(v_world_incest_depth, 0) > 0 then
    if public.citizens_have_close_kinship (
      p_parent_a_citizen_id,
      p_parent_b_citizen_id,
      v_world_incest_depth
    ) then
      return;
    end if;
  end if;

  return query
  insert into public.citizens (
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    surname,
    sex,
    status,
    born_on_turn_number,
    parent_a_citizen_id,
    parent_b_citizen_id,
    user_id,
    profile_photo_url,
    personality_text,
    skills_text,
    npc_trait_1,
    npc_trait_2,
    npc_secret_contradiction,
    npc_goal,
    npc_flaw
  )
  values (
    p_world_id,
    p_settlement_id,
    p_citizen_type,
    btrim(p_given_name),
    nullif(btrim(coalesce(p_surname, '')), ''),
    nullif(btrim(coalesce(p_sex, '')), ''),
    'alive',
    p_born_on_turn_number,
    p_parent_a_citizen_id,
    p_parent_b_citizen_id,
    p_user_id,
    nullif(btrim(coalesce(p_profile_photo_url, '')), ''),
    nullif(btrim(coalesce(p_personality_text, '')), ''),
    nullif(btrim(coalesce(p_skills_text, '')), ''),
    nullif(btrim(coalesce(p_npc_trait_1, '')), ''),
    nullif(btrim(coalesce(p_npc_trait_2, '')), ''),
    nullif(btrim(coalesce(p_npc_secret_contradiction, '')), ''),
    nullif(btrim(coalesce(p_npc_goal, '')), ''),
    nullif(btrim(coalesce(p_npc_flaw, '')), '')
  )
  returning *;
end;
$$;

revoke all on function public.create_citizen_internal (
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from
  public,
  anon,
  authenticated,
  service_role;

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
  v_backfill jsonb;
  v_backfill_citizen_id uuid;
  v_backfill_born_on_turn_number integer;
  v_birth jsonb;
  v_birth_settlement_id uuid;
  v_birth_given_name text;
  v_birth_surname text;
  v_birth_sex text;
  v_birth_born_on_turn_number integer;
  v_parent_a_citizen_id uuid;
  v_parent_b_citizen_id uuid;
  v_npc_trait_1 text;
  v_npc_trait_2 text;
  v_npc_secret_contradiction text;
  v_npc_goal text;
  v_npc_flaw text;
  v_death jsonb;
  v_citizen_id uuid;
  v_citizen_type text;
  v_citizen_status text;
  v_death_cause_category public.death_cause_category;
  v_death_cause text;
  v_partnership_change jsonb;
  v_partner_a_id uuid;
  v_partner_b_id uuid;
  v_partnership_id uuid;
  v_partnership_to_status text;
  v_formed_on_turn_number integer;
  v_ended_on_turn_number integer;
  v_assignment_clear jsonb;
begin
  backfill_count           := 0;
  citizen_birth_count      := 0;
  citizen_death_count      := 0;
  partnership_change_count := 0;
  assignment_clear_count   := 0;
  overshoot_stamp_count    := 0;

  for v_backfill in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'bornOnTurnBackfill', '[]'::jsonb))
  loop
    v_backfill_citizen_id          := (v_backfill ->> 'citizenId')::uuid;
    v_backfill_born_on_turn_number := (v_backfill ->> 'bornOnTurnNumber')::integer;

    update public.citizens
    set
      born_on_turn_number = v_backfill_born_on_turn_number
    where
      id = v_backfill_citizen_id;

    backfill_count := backfill_count + 1;
  end loop;

  -- Birth payloads now carry givenName/surname. Keep name as a compatibility
  -- fallback for older focused pgTAP fixtures.
  for v_birth in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
  loop
    v_birth_settlement_id       := (v_birth ->> 'settlementId')::uuid;
    v_birth_given_name          := coalesce(v_birth ->> 'givenName', v_birth ->> 'name');
    v_birth_surname             := v_birth ->> 'surname';
    v_birth_sex                 := v_birth ->> 'sex';
    v_birth_born_on_turn_number := (v_birth ->> 'bornOnTurnNumber')::integer;
    v_parent_a_citizen_id       := (v_birth ->> 'parentACitizenId')::uuid;
    v_parent_b_citizen_id       := (v_birth ->> 'parentBCitizenId')::uuid;
    v_npc_trait_1               := v_birth ->> 'npcTrait1';
    v_npc_trait_2               := v_birth ->> 'npcTrait2';
    v_npc_secret_contradiction  := v_birth ->> 'npcSecretContradiction';
    v_npc_goal                  := v_birth ->> 'npcGoal';
    v_npc_flaw                  := v_birth ->> 'npcFlaw';

    perform public.create_citizen_internal (
      p_world_id,
      v_birth_settlement_id,
      'npc',
      v_birth_given_name,
      v_birth_surname,
      v_birth_sex,
      null,
      v_birth_born_on_turn_number,
      v_parent_a_citizen_id,
      v_parent_b_citizen_id,
      null,
      null,
      null,
      v_npc_trait_1,
      v_npc_trait_2,
      v_npc_secret_contradiction,
      v_npc_goal,
      v_npc_flaw
    );

    citizen_birth_count := citizen_birth_count + 1;
  end loop;

  for v_death in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb))
  loop
    v_citizen_id           := (v_death ->> 'citizenId')::uuid;
    v_death_cause_category := (v_death ->> 'deathCauseCategory')::public.death_cause_category;
    v_death_cause          := v_death ->> 'deathCause';

    select c.citizen_type
    into v_citizen_type
    from public.citizens c
    where c.id = v_citizen_id;

    if not found then
      raise exception 'citizen % not found', v_citizen_id using errcode = 'P0001';
    end if;

    if v_citizen_type = 'player_character' then
      raise exception 'simulation engine may not kill a player character (citizen %)', v_citizen_id
        using errcode = 'P0001';
    end if;

    update public.citizens
    set
      status               = 'dead',
      death_cause_category = v_death_cause_category,
      death_cause          = v_death_cause
    where
      id = v_citizen_id;

    citizen_death_count := citizen_death_count + 1;
  end loop;

  for v_partnership_change in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
  loop
    v_partner_a_id          := (v_partnership_change ->> 'citizenAId')::uuid;
    v_partner_b_id          := (v_partnership_change ->> 'citizenBId')::uuid;
    v_partnership_to_status := v_partnership_change ->> 'toStatus';
    v_formed_on_turn_number := (v_partnership_change ->> 'formedOnTurnNumber')::integer;
    v_ended_on_turn_number  := (v_partnership_change ->> 'endedOnTurnNumber')::integer;

    if v_partnership_to_status = 'active' then
      select c.status into v_citizen_status
      from public.citizens c
      where c.id = v_partner_a_id;

      if not found then
        raise exception 'citizen % not found', v_partner_a_id using errcode = 'P0001';
      end if;

      if v_citizen_status = 'dead' then
        raise exception 'simulation engine may not form a partnership with a dead citizen (citizen %)', v_partner_a_id
          using errcode = 'P0001';
      end if;

      select c.status into v_citizen_status
      from public.citizens c
      where c.id = v_partner_b_id;

      if not found then
        raise exception 'citizen % not found', v_partner_b_id using errcode = 'P0001';
      end if;

      if v_citizen_status = 'dead' then
        raise exception 'simulation engine may not form a partnership with a dead citizen (citizen %)', v_partner_b_id
          using errcode = 'P0001';
      end if;

      insert into public.partnerships (
        citizen_a_id,
        citizen_b_id,
        status,
        formed_on_turn_number
      )
      values (
        v_partner_a_id,
        v_partner_b_id,
        'active',
        v_formed_on_turn_number
      );
    else
      select p.id
      into v_partnership_id
      from public.partnerships p
      where (
        (p.citizen_a_id = v_partner_a_id and p.citizen_b_id = v_partner_b_id)
        or (p.citizen_a_id = v_partner_b_id and p.citizen_b_id = v_partner_a_id)
      )
      and p.status = 'active';

      if not found then
        raise exception 'active partnership between % and % not found', v_partner_a_id, v_partner_b_id
          using errcode = 'P0001';
      end if;

      update public.partnerships
      set
        status               = v_partnership_to_status,
        ended_on_turn_number = v_ended_on_turn_number
      where
        id = v_partnership_id;
    end if;

    partnership_change_count := partnership_change_count + 1;
  end loop;

  for v_assignment_clear in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'assignmentClears', '[]'::jsonb))
  loop
    v_citizen_id := (v_assignment_clear ->> 'citizenId')::uuid;

    delete from public.citizen_assignments
    where
      citizen_id = v_citizen_id;

    assignment_clear_count := assignment_clear_count + 1;
  end loop;

  update public.turn_log_entries
  set
    turn_transition_id = p_transition_id
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
  authenticated,
  service_role;

revoke all on function public.internal_apply_turn_transition_advance_world_turn (uuid, integer)
from
  public,
  anon,
  authenticated,
  service_role;

revoke all on function public.internal_apply_turn_transition_construction_patches (uuid, integer, jsonb)
from
  public,
  anon,
  authenticated,
  service_role;

revoke all on function public.internal_apply_turn_transition_deposit_managed_pop_patches (jsonb)
from
  public,
  anon,
  authenticated,
  service_role;

revoke all on function public.internal_apply_turn_transition_log_entries_and_notifications (uuid, uuid, jsonb)
from
  public,
  anon,
  authenticated,
  service_role;

revoke all on function public.internal_apply_turn_transition_settlement_snapshots (uuid, uuid, jsonb)
from
  public,
  anon,
  authenticated,
  service_role;

revoke all on function public.internal_apply_turn_transition_stockpile_deltas (uuid, uuid, integer, jsonb)
from
  public,
  anon,
  authenticated,
  service_role;

revoke all on function public.internal_apply_turn_transition_trade_route_patches (jsonb)
from
  public,
  anon,
  authenticated,
  service_role;
