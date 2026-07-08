-- Migration: add_nation_treaties
-- #1089: nation_treaties encodes bilateral agreements with typed terms
-- (tribute, trade_agreement, royal_marriage, currency_exchange), reusing the
-- propose/respond lifecycle shape already proven by nation_relationships
-- (20260520000003) and the discovery/at_war gates proven by propose_trade_route
-- (20260911000000 / 20260913000000). Unlike nation_relationships, a treaty is
-- a single row naming both sides explicitly (proposer/responder), so there is
-- no bilateral-mirror trigger to write.
--
-- Terms are validated per treaty_type inside propose_nation_treaty rather
-- than via CHECK constraints, since the required shape differs by type and
-- jsonb CHECK constraints for this would be unreadable. currency_exchange is
-- rejected outright until a currencies table exists (see issue notes).
--
-- RLS: SELECT only, gated by nation_visible_to_current_user on both sides
-- (same AND-based pattern as nation_relationships_select_visible after
-- 20260911000000). All writes go through the four SECURITY DEFINER RPCs
-- below, so there are no INSERT/UPDATE/DELETE policies.
-- ---------------------------------------------------------------------------
-- nation_treaties
-- ---------------------------------------------------------------------------
create table public.nation_treaties (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  proposer_nation_id uuid not null references public.nations (id) on delete cascade,
  responder_nation_id uuid not null references public.nations (id) on delete cascade,
  treaty_type text not null,
  terms jsonb not null default '{}'::jsonb,
  status text not null default 'proposed',
  starts_turn_number integer,
  ends_turn_number integer,
  proposed_by_citizen_id uuid references public.citizens (id) on delete set null,
  responded_by_citizen_id uuid references public.citizens (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nation_treaties_distinct_nations_check check (proposer_nation_id <> responder_nation_id),
  constraint nation_treaties_treaty_type_check check (
    treaty_type in (
      'tribute',
      'trade_agreement',
      'royal_marriage',
      'currency_exchange'
    )
  ),
  constraint nation_treaties_status_check check (
    status in (
      'proposed',
      'active',
      'declined',
      'withdrawn',
      'expired',
      'broken'
    )
  ),
  constraint nation_treaties_turn_sequence_check check (
    starts_turn_number is null
    or ends_turn_number is null
    or ends_turn_number > starts_turn_number
  )
);

create index nation_treaties_proposer_nation_idx on public.nation_treaties (proposer_nation_id);

create index nation_treaties_responder_nation_idx on public.nation_treaties (responder_nation_id);

create index nation_treaties_world_idx on public.nation_treaties (world_id);

create trigger nation_treaties_set_updated_at before
update on public.nation_treaties for each row
execute function public.set_updated_at ();

alter table public.nation_treaties enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: SELECT only, both nations must be visible to the caller.
-- ---------------------------------------------------------------------------
create policy "nation_treaties_select_visible" on public.nation_treaties for
select
  to authenticated using (
    public.nation_visible_to_current_user (proposer_nation_id)
    and public.nation_visible_to_current_user (responder_nation_id)
  );

-- ---------------------------------------------------------------------------
-- propose_nation_treaty
-- ---------------------------------------------------------------------------
create or replace function public.propose_nation_treaty (
  p_proposer_nation_id uuid,
  p_responder_nation_id uuid,
  p_treaty_type text,
  p_terms jsonb,
  p_proposed_by_citizen_id uuid
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
    proposed_by_citizen_id
  )
  values (
    v_world_id,
    p_proposer_nation_id,
    p_responder_nation_id,
    p_treaty_type,
    v_terms,
    'proposed',
    p_proposed_by_citizen_id
  )
  returning * into v_treaty;

  return v_treaty;
end;
$$;

revoke all on function public.propose_nation_treaty (uuid, uuid, text, jsonb, uuid)
from
  public;

grant
execute on function public.propose_nation_treaty (uuid, uuid, text, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- respond_to_nation_treaty
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
    update public.nation_treaties
       set status = 'active',
           starts_turn_number = (select w.current_turn_number from public.worlds w where w.id = v_world_id),
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

revoke all on function public.respond_to_nation_treaty (uuid, text, uuid)
from
  public;

grant
execute on function public.respond_to_nation_treaty (uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- withdraw_nation_treaty
-- ---------------------------------------------------------------------------
create or replace function public.withdraw_nation_treaty (p_treaty_id uuid) returns public.nation_treaties language plpgsql security definer
set
  search_path = '' as $$
declare
  v_treaty  public.nation_treaties;
begin
  if p_treaty_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_treaty
    from public.nation_treaties
   where id = p_treaty_id
   for update;

  if v_treaty.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_treaty.status <> 'proposed' then
    raise exception 'only a proposed treaty can be withdrawn' using errcode = 'P0001';
  end if;

  if not public.current_user_manages_nation (v_treaty.proposer_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_treaty.world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  update public.nation_treaties
     set status = 'withdrawn'
   where id = p_treaty_id
  returning * into v_treaty;

  return v_treaty;
end;
$$;

revoke all on function public.withdraw_nation_treaty (uuid)
from
  public;

grant
execute on function public.withdraw_nation_treaty (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- break_nation_treaty
-- Breaking is allowed anytime (no met / at_war gate, unlike propose) by
-- either side's nation manager. Emits a notification to both nations'
-- managers, falling back to world admins per nation when a nation has no
-- living player_character nation_manager, following the recipient-resolution
-- pattern established by propose_trade_route / grant_nation_resources.
-- ---------------------------------------------------------------------------
create or replace function public.break_nation_treaty (p_treaty_id uuid, p_broken_by_citizen_id uuid) returns public.nation_treaties language plpgsql security definer
set
  search_path = '' as $$
declare
  v_treaty                      public.nation_treaties;
  v_proposer_recipient_count    integer;
  v_responder_recipient_count   integer;
begin
  if p_treaty_id is null or p_broken_by_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_treaty
    from public.nation_treaties
   where id = p_treaty_id
   for update;

  if v_treaty.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_treaty.status <> 'active' then
    raise exception 'only an active treaty can be broken' using errcode = 'P0001';
  end if;

  if not (
    public.current_user_manages_nation (v_treaty.proposer_nation_id)
    or public.current_user_manages_nation (v_treaty.responder_nation_id)
  ) then
    raise exception 'You do not have permission to manage either treaty nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_treaty.world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  update public.nation_treaties
     set status = 'broken'
   where id = p_treaty_id
  returning * into v_treaty;

  select count(*) into v_proposer_recipient_count
    from public.citizens c
   where c.status = 'alive'
     and c.citizen_type = 'player_character'
     and c.user_id is not null
     and c.role_type = 'nation_manager'
     and c.role_nation_id = v_treaty.proposer_nation_id;

  select count(*) into v_responder_recipient_count
    from public.citizens c
   where c.status = 'alive'
     and c.citizen_type = 'player_character'
     and c.user_id is not null
     and c.role_type = 'nation_manager'
     and c.role_nation_id = v_treaty.responder_nation_id;

  with
    proposer_managers as (
      select c.user_id, v_treaty.proposer_nation_id as nation_id
        from public.citizens c
       where v_proposer_recipient_count > 0
         and c.status = 'alive'
         and c.citizen_type = 'player_character'
         and c.user_id is not null
         and c.role_type = 'nation_manager'
         and c.role_nation_id = v_treaty.proposer_nation_id
    ),
    responder_managers as (
      select c.user_id, v_treaty.responder_nation_id as nation_id
        from public.citizens c
       where v_responder_recipient_count > 0
         and c.status = 'alive'
         and c.citizen_type = 'player_character'
         and c.user_id is not null
         and c.role_type = 'nation_manager'
         and c.role_nation_id = v_treaty.responder_nation_id
    ),
    world_admin_users as (
      select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
       where wa.world_id = v_treaty.world_id
         and u.status = 'active'
    ),
    all_recipients as (
      select user_id, nation_id from proposer_managers
      union
      select user_id, nation_id from responder_managers
      union
      select user_id, v_treaty.proposer_nation_id as nation_id from world_admin_users where v_proposer_recipient_count = 0
      union
      select user_id, v_treaty.responder_nation_id as nation_id from world_admin_users where v_responder_recipient_count = 0
    )
  insert into public.notifications (
    recipient_user_id,
    world_id,
    nation_id,
    notification_type,
    message_text
  )
  select
    ar.user_id,
    v_treaty.world_id,
    ar.nation_id,
    'nation.treaty_broken',
    'A nation treaty has been broken.'
  from all_recipients ar;

  return v_treaty;
end;
$$;

revoke all on function public.break_nation_treaty (uuid, uuid)
from
  public;

grant
execute on function public.break_nation_treaty (uuid, uuid) to authenticated;
