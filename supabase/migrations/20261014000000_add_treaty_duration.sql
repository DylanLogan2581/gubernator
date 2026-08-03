-- Migration: add_treaty_duration
-- #1133: ends_turn_number was never set anywhere, leaving treaties immortal
-- and the phaseTreaties expiry branch dead code. propose_nation_treaty now
-- accepts an optional p_duration_turns, stored on the row until accept time;
-- respond_to_nation_treaty (accept) derives ends_turn_number from
-- starts_turn_number + duration_turns, mirroring how appoint_nation_office
-- computes expires_turn_number in 20261009000001.
-- ---------------------------------------------------------------------------
alter table public.nation_treaties
add column duration_turns integer;

alter table public.nation_treaties
add constraint nation_treaties_duration_turns_check check (
  duration_turns is null
  or duration_turns > 0
);

-- ---------------------------------------------------------------------------
-- propose_nation_treaty: adds an optional p_duration_turns param. The old
-- 5-param signature must be dropped explicitly -- adding a 6th param makes
-- CREATE OR REPLACE create an overload instead of replacing it, leaving both
-- signatures ambiguous for 5-arg callers.
-- ---------------------------------------------------------------------------
drop function if exists public.propose_nation_treaty (uuid, uuid, text, jsonb, uuid);

create or replace function public.propose_nation_treaty (
  p_proposer_nation_id uuid,
  p_responder_nation_id uuid,
  p_treaty_type text,
  p_terms jsonb,
  p_proposed_by_citizen_id uuid,
  p_duration_turns integer default null
) returns public.nation_treaties language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id             uuid;
  v_responder_world_id   uuid;
  v_terms                jsonb;
  v_payer                text;
  v_resource_id           uuid;
  v_quantity              numeric;
  v_resource_world_id     uuid;
  v_resource_trashed      boolean;
  v_citizen_a_id          uuid;
  v_citizen_b_id          uuid;
  v_citizen_a_status      text;
  v_citizen_b_status      text;
  v_citizen_a_nation_id   uuid;
  v_citizen_b_nation_id   uuid;
  v_treaty                public.nation_treaties;
begin
  if p_proposer_nation_id is null
     or p_responder_nation_id is null
     or p_treaty_type is null
     or p_proposed_by_citizen_id is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_proposer_nation_id = p_responder_nation_id then
    raise exception 'proposer and responder nations must be different'
      using errcode = 'P0001';
  end if;

  if p_treaty_type not in ('tribute', 'trade_agreement', 'royal_marriage', 'currency_exchange') then
    raise exception 'invalid treaty_type' using errcode = 'P0001';
  end if;

  if p_duration_turns is not null and p_duration_turns <= 0 then
    raise exception 'p_duration_turns must be greater than zero'
      using errcode = 'P0001';
  end if;

  select world_id into v_world_id
    from public.nations
   where id = p_proposer_nation_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select world_id into v_responder_world_id
    from public.nations
   where id = p_responder_nation_id;

  if v_responder_world_id is null or v_responder_world_id <> v_world_id then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.current_user_manages_nation (p_proposer_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if not public.nations_have_met (p_proposer_nation_id, p_responder_nation_id) then
    raise exception 'Nations have not met.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.nation_relationships nr
     where (
             (nr.from_nation_id = p_proposer_nation_id and nr.to_nation_id = p_responder_nation_id)
          or (nr.from_nation_id = p_responder_nation_id and nr.to_nation_id = p_proposer_nation_id)
           )
       and nr.current_stance = 'at_war'
  ) then
    raise exception 'nations are at war' using errcode = 'P0001';
  end if;

  v_terms := coalesce(p_terms, '{}'::jsonb);

  if jsonb_typeof(v_terms) <> 'object' then
    raise exception 'terms must be a json object' using errcode = 'P0001';
  end if;

  if p_treaty_type = 'tribute' then
    v_payer       := v_terms ->> 'payer';
    v_resource_id := (v_terms ->> 'resource_id')::uuid;
    v_quantity    := (v_terms ->> 'quantity_per_turn')::numeric;

    if v_payer is null or v_payer not in ('proposer', 'responder') then
      raise exception 'tribute terms.payer must be ''proposer'' or ''responder'''
        using errcode = 'P0001';
    end if;

    if v_resource_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'tribute terms.quantity_per_turn must be greater than zero'
        using errcode = 'P0001';
    end if;

    select r.world_id, r.is_trashed into v_resource_world_id, v_resource_trashed
      from public.resources r
     where r.id = v_resource_id;

    if v_resource_world_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_resource_world_id <> v_world_id then
      raise exception 'resource does not belong to the same world as the treaty nations'
        using errcode = 'P0001';
    end if;

    if v_resource_trashed then
      raise exception 'resource is trashed' using errcode = 'P0001';
    end if;
  elsif p_treaty_type = 'trade_agreement' then
    if v_terms <> '{}'::jsonb then
      raise exception 'trade_agreement terms must be an empty object'
        using errcode = 'P0001';
    end if;
  elsif p_treaty_type = 'royal_marriage' then
    v_citizen_a_id := (v_terms ->> 'citizen_a_id')::uuid;
    v_citizen_b_id := (v_terms ->> 'citizen_b_id')::uuid;

    if v_citizen_a_id is null or v_citizen_b_id is null or v_citizen_a_id = v_citizen_b_id then
      raise exception 'royal_marriage terms must reference two distinct citizens'
        using errcode = 'P0001';
    end if;

    select c.status, s.nation_id into v_citizen_a_status, v_citizen_a_nation_id
      from public.citizens c
      join public.settlements s on s.id = c.settlement_id
     where c.id = v_citizen_a_id;

    select c.status, s.nation_id into v_citizen_b_status, v_citizen_b_nation_id
      from public.citizens c
      join public.settlements s on s.id = c.settlement_id
     where c.id = v_citizen_b_id;

    if v_citizen_a_status is distinct from 'alive' or v_citizen_b_status is distinct from 'alive' then
      raise exception 'royal_marriage requires two living citizens' using errcode = 'P0001';
    end if;

    if not (
      (v_citizen_a_nation_id = p_proposer_nation_id and v_citizen_b_nation_id = p_responder_nation_id)
      or (v_citizen_a_nation_id = p_responder_nation_id and v_citizen_b_nation_id = p_proposer_nation_id)
    ) then
      raise exception 'royal_marriage citizens must belong one to each treaty nation'
        using errcode = 'P0001';
    end if;
  else
    raise exception 'currency exchange treaties are not supported until currencies exist'
      using errcode = 'P0001';
  end if;

  insert into public.nation_treaties (
    world_id,
    proposer_nation_id,
    responder_nation_id,
    treaty_type,
    terms,
    status,
    proposed_by_citizen_id,
    duration_turns
  )
  values (
    v_world_id,
    p_proposer_nation_id,
    p_responder_nation_id,
    p_treaty_type,
    v_terms,
    'proposed',
    p_proposed_by_citizen_id,
    p_duration_turns
  )
  returning * into v_treaty;

  return v_treaty;
end;
$$;

revoke all on function public.propose_nation_treaty (uuid, uuid, text, jsonb, uuid, integer)
from
  public;

grant
execute on function public.propose_nation_treaty (uuid, uuid, text, jsonb, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- respond_to_nation_treaty: accept now derives ends_turn_number from the
-- treaty's stored duration_turns, same signature as 20261012000000 so a
-- plain CREATE OR REPLACE is enough.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_nation_treaty (
  p_treaty_id uuid,
  p_response text,
  p_responded_by_citizen_id uuid
) returns public.nation_treaties language plpgsql security definer
set
  search_path = '' as $$
declare
  v_treaty  public.nation_treaties;
  v_world_id uuid;
  v_turn_number integer;
begin
  if p_treaty_id is null or p_response is null or p_responded_by_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_response not in ('accept', 'decline') then
    raise exception 'response must be ''accept'' or ''decline''' using errcode = 'P0001';
  end if;

  select * into v_treaty
    from public.nation_treaties
   where id = p_treaty_id
   for update;

  if v_treaty.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_treaty.status <> 'proposed' then
    raise exception 'treaty cannot be responded to in its current status'
      using errcode = 'P0001';
  end if;

  if not public.current_user_manages_nation (v_treaty.responder_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  v_world_id := v_treaty.world_id;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_response = 'accept' then
    if not public.nations_have_met (v_treaty.proposer_nation_id, v_treaty.responder_nation_id) then
      raise exception 'Nations have not met.' using errcode = 'P0001';
    end if;

    if exists (
      select 1
        from public.nation_relationships nr
       where (
               (nr.from_nation_id = v_treaty.proposer_nation_id and nr.to_nation_id = v_treaty.responder_nation_id)
            or (nr.from_nation_id = v_treaty.responder_nation_id and nr.to_nation_id = v_treaty.proposer_nation_id)
             )
         and nr.current_stance = 'at_war'
    ) then
      raise exception 'nations are at war' using errcode = 'P0001';
    end if;

    select w.current_turn_number into v_turn_number
      from public.worlds w
     where w.id = v_world_id;

    update public.nation_treaties
       set status = 'active',
           starts_turn_number = v_turn_number,
           ends_turn_number = case
             when v_treaty.duration_turns is null then null
             else v_turn_number + v_treaty.duration_turns
           end,
           responded_by_citizen_id = p_responded_by_citizen_id
     where id = p_treaty_id
    returning * into v_treaty;
  else
    update public.nation_treaties
       set status = 'declined',
           responded_by_citizen_id = p_responded_by_citizen_id
     where id = p_treaty_id
    returning * into v_treaty;
  end if;

  return v_treaty;
end;
$$;
