-- Migration: add_office_terms
-- #1123: elected/appointed offices can carry a fixed term. Expiry vacates
-- the seat deterministically at turn transition (no RNG), archiving the
-- row instead of deleting it so rosters keep history. Humans re-run the
-- election / roleplay a successor manually; this only handles the
-- mechanical vacate + notify.
-- ---------------------------------------------------------------------------
-- 1. Columns: office_types.default_term_turns (prefill for the appoint
-- dialog, overridable), nation_offices.term_turns / expires_turn_number
-- (computed at appointment) / ended_turn_number (archive stamp, set by the
-- turn hook instead of deleting the row).
-- ---------------------------------------------------------------------------
alter table public.office_types
add column default_term_turns integer;

alter table public.office_types
add constraint office_types_default_term_turns_check check (
  default_term_turns is null
  or default_term_turns > 0
);

alter table public.nation_offices
add column term_turns integer,
add column expires_turn_number integer,
add column ended_turn_number integer;

alter table public.nation_offices
add constraint nation_offices_term_turns_check check (
  term_turns is null
  or term_turns > 0
);

alter table public.nation_offices
add constraint nation_offices_ended_turn_number_check check (
  ended_turn_number is null
  or ended_turn_number >= appointed_turn_number
);

comment on column public.nation_offices.term_turns is 'Fixed term length in turns, set at appointment. Null = indefinite, never expires (#1123).';

comment on column public.nation_offices.expires_turn_number is 'Computed at appointment as appointed_turn_number + term_turns. Null when term_turns is null.';

comment on column public.nation_offices.ended_turn_number is 'Set by the turn hook when expires_turn_number <= the new turn. The row is kept (not deleted) so rosters can show history; active officeholder queries must filter ended_turn_number is null.';

-- ---------------------------------------------------------------------------
-- 2. Uniqueness / active-officeholder scoping: an ended (archived) row must
-- not block re-appointing the same citizen to the same office, so the
-- partial unique indexes now also require ended_turn_number is null.
-- ---------------------------------------------------------------------------
drop index public.nation_offices_nation_unique_idx;

create unique index nation_offices_nation_unique_idx on public.nation_offices (nation_id, citizen_id, office_type_id)
where
  nation_id is not null
  and ended_turn_number is null;

drop index public.nation_offices_settlement_unique_idx;

create unique index nation_offices_settlement_unique_idx on public.nation_offices (settlement_id, citizen_id, office_type_id)
where
  settlement_id is not null
  and ended_turn_number is null;

create index nation_offices_expires_turn_number_idx on public.nation_offices (expires_turn_number)
where
  expires_turn_number is not null
  and ended_turn_number is null;

-- ---------------------------------------------------------------------------
-- 3. office_types grants: default_term_turns is writable wherever name/
-- max_holders already are (world admin for world-default rows, nation
-- manager for that nation's custom rows -- RLS unchanged, #1114).
-- ---------------------------------------------------------------------------
grant insert (
  world_id,
  nation_id,
  name,
  description,
  scope,
  icon,
  color,
  max_holders,
  excludes_from_labor,
  default_term_turns
) on public.office_types to authenticated;

grant
update (
  name,
  description,
  icon,
  color,
  max_holders,
  excludes_from_labor,
  default_term_turns
) on public.office_types to authenticated;

-- ---------------------------------------------------------------------------
-- 4. appoint_nation_office: adds an optional p_term_turns param (the caller
-- resolves the default_term_turns prefill client-side and may override it).
-- expires_turn_number is computed here so it's always consistent with
-- appointed_turn_number. max_holders now only counts active (non-ended)
-- holders. The old 3-param signature must be dropped explicitly -- adding a
-- 4th param makes CREATE OR REPLACE create an overload instead of replacing
-- it, leaving both signatures ambiguous for 3-arg callers.
-- ---------------------------------------------------------------------------
drop function if exists public.appoint_nation_office (uuid, text, uuid);

create or replace function public.appoint_nation_office (
  p_nation_id uuid,
  p_office_type text,
  p_citizen_id uuid,
  p_term_turns integer default null
) returns public.nation_offices language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_government_type text;
  v_office_type_id uuid;
  v_office_type_nation_id uuid;
  v_max_holders integer;
  v_current_holders integer;
  v_office_allowed boolean;
  v_citizen_status text;
  v_citizen_nation_id uuid;
  v_row public.nation_offices%rowtype;
begin
  if p_nation_id is null or p_office_type is null or p_citizen_id is null then
    raise exception 'nation, office type, and citizen are required'
      using errcode = '22023';
  end if;

  if p_term_turns is not null and p_term_turns <= 0 then
    raise exception 'p_term_turns must be positive'
      using errcode = '22023', hint = 'invalid_term_turns';
  end if;

  select n.world_id, w.status, w.current_turn_number, n.government_type
  into v_world_id, v_world_status, v_turn_number, v_government_type
  from public.nations n
  inner join public.worlds w on w.id = n.world_id
  where n.id = p_nation_id;

  if v_world_id is null then
    raise exception 'nation not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  select ot.id, ot.nation_id, ot.max_holders
  into v_office_type_id, v_office_type_nation_id, v_max_holders
  from public.office_types ot
  where ot.world_id = v_world_id
    and (
      ot.nation_id = p_nation_id
      or ot.nation_id is null
    )
    and ot.name = p_office_type
    and ot.scope = 'nation'
  order by ot.nation_id nulls last
  limit 1;

  if v_office_type_id is null then
    raise exception 'office type % not found for this nation', p_office_type
      using errcode = '22023', hint = 'office_type_not_found';
  end if;

  if v_office_type_nation_id is null then
    v_office_allowed := (
      case v_government_type
        when 'monarchy' then p_office_type in ('chancellor', 'treasurer', 'bank_governor')
        when 'republic' then p_office_type in ('senator', 'treasurer', 'bank_governor')
        when 'theocracy' then p_office_type in ('clergy', 'treasurer', 'bank_governor')
        when 'tribal_council' then p_office_type in ('elder', 'treasurer', 'bank_governor')
        when 'confederation' then p_office_type in ('delegate', 'treasurer', 'bank_governor')
        when 'despotism' then p_office_type in ('chancellor', 'treasurer', 'bank_governor')
        else false
      end
    );

    if not v_office_allowed then
      raise exception 'office type % is not allowed for government type %', p_office_type, v_government_type
        using errcode = '22023', hint = 'office_type_not_allowed';
    end if;
  end if;

  if v_max_holders is not null then
    select count(*)
    into v_current_holders
    from public.nation_offices
    where nation_id = p_nation_id
      and office_type_id = v_office_type_id
      and ended_turn_number is null;

    if v_current_holders >= v_max_holders then
      raise exception 'office type % already has the maximum number of holders', p_office_type
        using errcode = '22023', hint = 'office_type_max_holders';
    end if;
  end if;

  select c.status, s.nation_id
  into v_citizen_status, v_citizen_nation_id
  from public.citizens c
  left join public.settlements s on s.id = c.settlement_id
  where c.id = p_citizen_id;

  if v_citizen_status is null then
    raise exception 'citizen not found'
      using errcode = 'P0002';
  end if;

  if v_citizen_status <> 'alive' then
    raise exception 'citizen must be alive to hold a nation office'
      using errcode = '22023', hint = 'citizen_not_alive';
  end if;

  if v_citizen_nation_id is null or v_citizen_nation_id <> p_nation_id then
    raise exception 'citizen must belong to a settlement of this nation'
      using errcode = '22023', hint = 'citizen_not_in_nation';
  end if;

  begin
    insert into public.nation_offices (
      world_id,
      nation_id,
      office_type_id,
      citizen_id,
      appointed_turn_number,
      term_turns,
      expires_turn_number
    )
    values (
      v_world_id, p_nation_id, v_office_type_id, p_citizen_id, v_turn_number,
      p_term_turns,
      case when p_term_turns is null then null else v_turn_number + p_term_turns end
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'citizen already holds this office'
        using errcode = '23505', hint = 'office_already_held';
  end;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. appoint_settlement_office: mirrors the p_term_turns addition above,
-- including dropping the old 3-param signature first.
-- ---------------------------------------------------------------------------
drop function if exists public.appoint_settlement_office (uuid, text, uuid);

create or replace function public.appoint_settlement_office (
  p_settlement_id uuid,
  p_office_type text,
  p_citizen_id uuid,
  p_term_turns integer default null
) returns public.nation_offices language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_nation_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_office_type_id uuid;
  v_max_holders integer;
  v_current_holders integer;
  v_citizen_status text;
  v_citizen_settlement_id uuid;
  v_row public.nation_offices%rowtype;
begin
  if p_settlement_id is null or p_office_type is null or p_citizen_id is null then
    raise exception 'settlement, office type, and citizen are required'
      using errcode = '22023';
  end if;

  if p_term_turns is not null and p_term_turns <= 0 then
    raise exception 'p_term_turns must be positive'
      using errcode = '22023', hint = 'invalid_term_turns';
  end if;

  select n.world_id, s.nation_id, w.status, w.current_turn_number
  into v_world_id, v_nation_id, v_world_status, v_turn_number
  from public.settlements s
  inner join public.nations n on n.id = s.nation_id
  inner join public.worlds w on w.id = n.world_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'settlement not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_settlement (p_settlement_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  select ot.id, ot.max_holders
  into v_office_type_id, v_max_holders
  from public.office_types ot
  where ot.world_id = v_world_id
    and (
      ot.nation_id = v_nation_id
      or ot.nation_id is null
    )
    and ot.name = p_office_type
    and ot.scope = 'settlement'
  order by ot.nation_id nulls last
  limit 1;

  if v_office_type_id is null then
    raise exception 'office type % not found for this settlement', p_office_type
      using errcode = '22023', hint = 'office_type_not_found';
  end if;

  if v_max_holders is not null then
    select count(*)
    into v_current_holders
    from public.nation_offices
    where settlement_id = p_settlement_id
      and office_type_id = v_office_type_id
      and ended_turn_number is null;

    if v_current_holders >= v_max_holders then
      raise exception 'office type % already has the maximum number of holders', p_office_type
        using errcode = '22023', hint = 'office_type_max_holders';
    end if;
  end if;

  select c.status, c.settlement_id
  into v_citizen_status, v_citizen_settlement_id
  from public.citizens c
  where c.id = p_citizen_id;

  if v_citizen_status is null then
    raise exception 'citizen not found'
      using errcode = 'P0002';
  end if;

  if v_citizen_status <> 'alive' then
    raise exception 'citizen must be alive to hold a settlement office'
      using errcode = '22023', hint = 'citizen_not_alive';
  end if;

  if v_citizen_settlement_id is null or v_citizen_settlement_id <> p_settlement_id then
    raise exception 'citizen must be a resident of this settlement'
      using errcode = '22023', hint = 'citizen_not_resident';
  end if;

  begin
    insert into public.nation_offices (
      world_id,
      settlement_id,
      office_type_id,
      citizen_id,
      appointed_turn_number,
      term_turns,
      expires_turn_number
    )
    values (
      v_world_id, p_settlement_id, v_office_type_id, p_citizen_id, v_turn_number,
      p_term_turns,
      case when p_term_turns is null then null else v_turn_number + p_term_turns end
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'citizen already holds this office'
        using errcode = '23505', hint = 'office_already_held';
  end;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. renew_office: "Renew" = re-appoint the same holder with a fresh term
-- in place (appointing again would collide with the active-officeholder
-- unique index). Works for both nation- and settlement-scoped rows; the
-- office must still be active (not yet ended by expiry).
-- ---------------------------------------------------------------------------
create or replace function public.renew_office (
  p_office_id uuid,
  p_term_turns integer default null
) returns public.nation_offices language plpgsql security definer
set
  search_path = '' as $$
declare
  v_office public.nation_offices%rowtype;
  v_world_status text;
  v_turn_number integer;
  v_row public.nation_offices%rowtype;
begin
  if p_office_id is null then
    raise exception 'p_office_id must not be null'
      using errcode = '22023';
  end if;

  if p_term_turns is not null and p_term_turns <= 0 then
    raise exception 'p_term_turns must be positive'
      using errcode = '22023', hint = 'invalid_term_turns';
  end if;

  select o.* into v_office
  from public.nation_offices o
  where o.id = p_office_id;

  if v_office.id is null then
    raise exception 'office not found'
      using errcode = 'P0002';
  end if;

  if v_office.ended_turn_number is not null then
    raise exception 'office term has already ended'
      using errcode = '22023', hint = 'office_already_ended';
  end if;

  select w.status, w.current_turn_number
  into v_world_status, v_turn_number
  from public.worlds w
  where w.id = v_office.world_id;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if v_office.nation_id is not null then
    if not public.current_user_manages_nation (v_office.nation_id) then
      raise exception 'insufficient privilege'
        using errcode = '42501';
    end if;
  else
    if not public.current_user_manages_settlement (v_office.settlement_id) then
      raise exception 'insufficient privilege'
        using errcode = '42501';
    end if;
  end if;

  update public.nation_offices
  set
    appointed_turn_number = v_turn_number,
    term_turns = p_term_turns,
    expires_turn_number = case when p_term_turns is null then null else v_turn_number + p_term_turns end
  where id = p_office_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.renew_office (uuid, integer)
from
  public;

grant
execute on function public.renew_office (uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. resolve_government_body_member_ids: office_type body members must
-- exclude ended (expired, archived) officeholders. Copied from the latest
-- prior definition (20261007000001) with only that filter added.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_government_body_member_ids (p_body_id uuid) returns setof uuid language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_nation_id uuid;
  v_settlement_id uuid;
  v_composition jsonb;
  v_entry jsonb;
  v_kind text;
  v_member_ids uuid[] := '{}';
begin
  select nation_id, settlement_id, composition_json
  into v_nation_id, v_settlement_id, v_composition
  from public.government_bodies
  where id = p_body_id;

  if not found then
    return;
  end if;

  for v_entry in select value from jsonb_array_elements(v_composition)
  loop
    v_kind := v_entry ->> 'kind';

    if v_kind = 'office_type' then
      v_member_ids := v_member_ids || array(
        select o.citizen_id
        from public.nation_offices o
        where o.office_type_id = (v_entry ->> 'office_type_id')::uuid
          and o.ended_turn_number is null
          and (
            (v_nation_id is not null and o.nation_id = v_nation_id)
            or (v_settlement_id is not null and o.settlement_id = v_settlement_id)
          )
      );
    elsif v_kind = 'citizens' then
      v_member_ids := v_member_ids || array(
        select elem::uuid
        from jsonb_array_elements_text(v_entry -> 'citizen_ids') as elem
      );
    elsif v_kind = 'ruler' then
      if v_nation_id is not null then
        v_member_ids := v_member_ids || array(
          select c.id from public.citizens c
          where c.role_type = 'nation_manager' and c.role_nation_id = v_nation_id
        );
      else
        v_member_ids := v_member_ids || array(
          select c.id from public.citizens c
          where c.role_type = 'settlement_manager' and c.role_settlement_id = v_settlement_id
        );
      end if;
    elsif v_kind = 'settlement_managers' then
      if v_nation_id is not null then
        v_member_ids := v_member_ids || array(
          select c.id from public.citizens c
          where c.role_type = 'settlement_manager'
            and c.role_settlement_id in (
              select s.id from public.settlements s where s.nation_id = v_nation_id
            )
        );
      end if;
    end if;
  end loop;

  return query
    select distinct m
    from unnest(v_member_ids) as m
    inner join public.citizens c on c.id = m
    where c.status = 'alive';
end;
$$;

revoke all on function public.resolve_government_body_member_ids (uuid)
from
  public;

grant
execute on function public.resolve_government_body_member_ids (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. current_user_holds_nation_office / current_user_nation_currency_actor_
-- citizen_id: an ended office no longer counts as "holding" it. Copied from
-- the latest prior definition (20261003000000) with the filter added.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_holds_nation_office (p_nation_id uuid, p_office_type text) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.nation_offices o
    join public.office_types ot on ot.id = o.office_type_id
    join public.citizens c on c.id = o.citizen_id
    where o.nation_id = p_nation_id
      and o.ended_turn_number is null
      and ot.name = p_office_type
      and c.user_id = auth.uid()
      and c.citizen_type = 'player_character'
      and c.status = 'alive'
  )
$$;

create or replace function public.current_user_nation_currency_actor_citizen_id (p_nation_id uuid) returns uuid language sql stable security definer
set
  search_path = '' as $$
  select coalesce(
    (
      select o.citizen_id
      from public.nation_offices o
      join public.office_types ot on ot.id = o.office_type_id
      join public.citizens c on c.id = o.citizen_id
      where o.nation_id = p_nation_id
        and o.ended_turn_number is null
        and ot.name = 'bank_governor'
        and c.user_id = auth.uid()
        and c.citizen_type = 'player_character'
        and c.status = 'alive'
      limit 1
    ),
    (
      select c.id
      from public.citizens c
      where c.role_type = 'nation_manager'
        and c.role_nation_id = p_nation_id
        and c.user_id = auth.uid()
        and c.citizen_type = 'player_character'
        and c.status = 'alive'
      limit 1
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- 9. nation_offices_prune_on_citizen_change: an already-ended (archived)
-- row is history, not an active seat -- citizen status/settlement changes
-- must not delete it. Copied from the latest prior definition
-- (20261004000000) with that guard added.
-- ---------------------------------------------------------------------------
create or replace function public.nation_offices_prune_on_citizen_change () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  delete from public.nation_offices o
  where o.citizen_id = new.id
    and o.ended_turn_number is null
    and (
      new.status <> 'alive'
      or (
        o.nation_id is not null
        and (
          new.settlement_id is null
          or not exists (
            select 1
            from public.settlements s
            where s.id = new.settlement_id
              and s.nation_id = o.nation_id
          )
        )
      )
      or (
        o.settlement_id is not null
        and (
          new.settlement_id is null
          or new.settlement_id <> o.settlement_id
        )
      )
    );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. citizen_directory_view: the office_types aggregate must stop counting
-- ended offices. Copied from the latest prior definition (20261003000000)
-- with only that one filter added.
-- ---------------------------------------------------------------------------
create or replace view public.citizen_directory_view
with
  (security_invoker = true) as
select
  c.id,
  c.world_id,
  c.name,
  c.sex,
  c.status,
  c.citizen_type,
  c.born_on_turn_number,
  w.current_turn_number - c.born_on_turn_number as age_turns,
  c.settlement_id,
  s.name as settlement_name,
  s.nation_id,
  n.name as nation_name,
  ca.assignment_type,
  case ca.assignment_type
    when 'standard_job' then jd_standard.name
    when 'deposit' then jd_deposit.name
    when 'husbandry' then jd_husbandry.name
    when 'culling' then jd_culling.name
    when 'trade_route' then 'Trader'
    when 'construction_project' then 'Construction'
    else null
  end as assignment_label,
  (
    select
      string_agg(
        ot.name,
        ', '
        order by
          ot.name
      )
    from
      public.nation_offices o
      join public.office_types ot on ot.id = o.office_type_id
    where
      o.citizen_id = c.id
      and o.ended_turn_number is null
  ) as office_types,
  el.name as education_level_name
from
  public.citizens c
  join public.worlds w on w.id = c.world_id
  left join public.settlements s on s.id = c.settlement_id
  left join public.nations n on n.id = s.nation_id
  left join public.citizen_assignments ca on ca.citizen_id = c.id
  left join public.job_definitions jd_standard on jd_standard.id = ca.job_id
  and ca.assignment_type = 'standard_job'
  left join public.deposit_instances di on di.id = ca.deposit_instance_id
  left join public.deposit_types dt on dt.id = di.deposit_type_id
  left join public.job_definitions jd_deposit on jd_deposit.id = dt.job_id
  left join public.managed_population_instances mpi on mpi.id = ca.managed_population_instance_id
  left join public.managed_population_types mpt on mpt.id = mpi.managed_population_type_id
  left join public.job_definitions jd_husbandry on jd_husbandry.id = mpt.husbandry_job_id
  left join public.job_definitions jd_culling on jd_culling.id = mpt.culling_job_id
  left join public.education_levels el on el.id = c.education_level_id;

grant
select
  on public.citizen_directory_view to authenticated;

-- ---------------------------------------------------------------------------
-- 11. internal_apply_turn_transition_office_term_expiry: turn-hook. Any
-- active office (ended_turn_number is null) whose expires_turn_number has
-- been reached by the new turn is archived (ended_turn_number set, row
-- kept for history) and a log entry + notification to that office's
-- nation/settlement manager are emitted. Deterministic, no RNG. Mirrors
-- internal_apply_turn_transition_law_amendment_expiry (#1119).
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_office_term_expiry (
  p_transition_id uuid,
  p_world_id uuid,
  p_turn_number integer,
  out office_term_expired_count integer,
  out office_term_expiry_notification_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_office record;
  v_rows integer;
begin
  office_term_expired_count := 0;
  office_term_expiry_notification_count := 0;

  for v_office in
    select o.id, o.citizen_id, c.name as citizen_name, ot.name as office_type_name,
      o.nation_id, o.settlement_id
    from public.nation_offices o
    inner join public.citizens c on c.id = o.citizen_id
    inner join public.office_types ot on ot.id = o.office_type_id
    where o.world_id = p_world_id
      and o.ended_turn_number is null
      and o.expires_turn_number is not null
      and o.expires_turn_number <= p_turn_number
    order by o.id
  loop
    update public.nation_offices
    set ended_turn_number = p_turn_number
    where id = v_office.id;

    office_term_expired_count := office_term_expired_count + 1;

    insert into public.turn_log_entries (
      turn_transition_id, world_id, nation_id, settlement_id, log_category, payload_jsonb
    )
    values (
      p_transition_id, p_world_id, v_office.nation_id, v_office.settlement_id,
      'office.term_ended',
      jsonb_build_object(
        'officeId', v_office.id,
        'citizenId', v_office.citizen_id,
        'citizenName', v_office.citizen_name,
        'officeTypeName', v_office.office_type_name
      )
    );

    insert into public.notifications (
      recipient_user_id, world_id, nation_id, settlement_id, notification_type, message_text,
      severity, generated_in_transition_id
    )
    select
      recipients.user_id, p_world_id, v_office.nation_id, v_office.settlement_id,
      'office.term_ended'::public.notification_type,
      format('%s''s term as %s has ended.', v_office.citizen_name, v_office.office_type_name),
      'info'::public.notification_severity,
      p_transition_id
    from (
      select c.user_id
      from public.citizens c
      where c.status = 'alive'
        and c.citizen_type = 'player_character'
        and c.user_id is not null
        and (
          (v_office.nation_id is not null and c.role_type = 'nation_manager' and c.role_nation_id = v_office.nation_id)
          or (v_office.settlement_id is not null and c.role_type = 'settlement_manager' and c.role_settlement_id = v_office.settlement_id)
        )
      union
      select wa.user_id from public.world_admins wa where wa.world_id = p_world_id
      union
      select u.id from public.users u where u.is_super_admin = true
    ) as recipients (user_id)
    inner join public.users u on u.id = recipients.user_id and u.status = 'active'
    on conflict (
      generated_in_transition_id,
      recipient_user_id,
      notification_type,
      coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(citizen_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(settlement_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) where generated_in_transition_id is not null
    do nothing;

    get diagnostics v_rows = row_count;
    office_term_expiry_notification_count := office_term_expiry_notification_count + v_rows;
  end loop;
end;
$$;

revoke all on function public.internal_apply_turn_transition_office_term_expiry (uuid, uuid, integer)
from
  public;

revoke
execute on function public.internal_apply_turn_transition_office_term_expiry (uuid, uuid, integer)
from
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- 12. apply_turn_transition: add the office-term-expiry phase. Copied in
-- full from the latest prior definition (20261007000001) with only the new
-- declare vars, the new helper call (after law amendment expiry), and the
-- new patchCounts entries added.
-- ---------------------------------------------------------------------------
create or replace function public.apply_turn_transition (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb,
  p_transition_id uuid,
  p_forecast_snapshot_jsonb jsonb default null
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_world_turn integer;
  v_transition public.turn_transitions%rowtype;
  v_result jsonb;
  -- §C36 cross-world guard loop variables (shared across all validation loops)
  v_delta jsonb;
  v_update jsonb;
  v_route_outcome jsonb;
  v_backfill jsonb;
  v_birth jsonb;
  v_death jsonb;
  v_partnership_change jsonb;
  v_assignment_clear jsonb;
  v_nation_snapshot jsonb;
  v_treaty_change jsonb;
  v_currency_snapshot jsonb;
  v_currency_update jsonb;
  v_citizen_education_patch jsonb;
  v_enrollment_progress_update jsonb;
  v_enrollment_graduation jsonb;
  v_army_snapshot jsonb;
  v_deserted_soldier jsonb;
  v_disbanded_unit jsonb;
  v_deceased_soldier_id uuid;
  v_check_id uuid;
  -- §H9 stockpile re-validation variables
  v_settlement_id uuid;
  v_resource_id uuid;
  v_quantity_before numeric(18, 4);
  v_actual_quantity numeric(18, 4);
  -- §H10a/§H10b deposit & managed-pop re-validation variables (issue #670)
  v_resource_delta jsonb;
  v_deposit_instance_id uuid;
  v_remaining_quantity_before numeric(18, 4);
  v_actual_remaining_quantity numeric(18, 4);
  v_managed_pop_instance_id uuid;
  v_current_count_before numeric(18, 4);
  v_actual_current_count numeric(18, 4);
  -- §C36 id-sets per entity table
  v_valid_settlement_ids uuid[];
  v_valid_resource_ids uuid[];
  v_valid_project_ids uuid[];
  v_valid_building_ids uuid[];
  v_valid_building_blueprint_ids uuid[];
  v_valid_building_blueprint_tier_ids uuid[];
  v_valid_deposit_instance_ids uuid[];
  v_valid_managed_pop_instance_ids uuid[];
  v_valid_trade_route_ids uuid[];
  v_valid_citizen_ids uuid[];
  v_valid_nation_ids uuid[];
  v_valid_treaty_ids uuid[];
  v_valid_currency_ids uuid[];
  v_valid_education_level_ids uuid[];
  v_valid_enrollment_ids uuid[];
  v_valid_army_ids uuid[];
  v_valid_army_unit_ids uuid[];
  v_valid_unit_soldier_ids uuid[];
  -- phase result counts (populated by internal helpers)
  v_stockpile_delta_count integer := 0;
  v_construction_update_count integer := 0;
  v_buildings_created_count integer := 0;
  v_building_state_change_count integer := 0;
  v_deposit_update_count integer := 0;
  v_managed_pop_update_count integer := 0;
  v_trade_route_outcome_count integer := 0;
  v_backfill_count integer := 0;
  v_citizen_birth_count integer := 0;
  v_citizen_death_count integer := 0;
  v_partnership_change_count integer := 0;
  v_assignment_clear_count integer := 0;
  v_overshoot_stamp_count integer := 0;
  v_event_status_update_count integer := 0;
  v_citizen_memory_count integer := 0;
  v_log_entry_count integer := 0;
  v_notification_count integer := 0;
  v_settlement_snapshot_count integer := 0;
  v_readiness_reset_count integer := 0;
  v_nation_readiness_reset_count integer := 0;
  v_nation_readiness_votes_cleared_count integer := 0;
  v_nation_stockpile_delta_count integer := 0;
  v_nation_turn_snapshot_count integer := 0;
  v_treaty_status_change_count integer := 0;
  v_nation_currency_snapshot_count integer := 0;
  v_nation_currency_update_count integer := 0;
  v_nation_currency_notification_count integer := 0;
  v_citizen_education_patch_count integer := 0;
  v_enrollment_progress_update_count integer := 0;
  v_enrollment_graduation_count integer := 0;
  v_army_turn_snapshot_count integer := 0;
  v_deserted_soldier_count integer := 0;
  v_disbanded_unit_count integer := 0;
  v_deceased_soldier_count integer := 0;
  v_amendment_expired_count integer := 0;
  v_amendment_expiry_notification_count integer := 0;
  v_office_term_expired_count integer := 0;
  v_office_term_expiry_notification_count integer := 0;
begin
  -- Non-null param validation
  if p_world_id is null then
    raise exception 'p_world_id must not be null' using errcode = 'P0001';
  end if;

  if p_expected_turn_number is null then
    raise exception 'p_expected_turn_number must not be null' using errcode = 'P0001';
  end if;

  if p_payload is null then
    raise exception 'p_payload must not be null' using errcode = 'P0001';
  end if;

  if p_transition_id is null then
    raise exception 'p_transition_id must not be null' using errcode = 'P0001';
  end if;

  -- Lock the world row so concurrent callers queue behind this transaction
  select
    w.status,
    w.current_turn_number into v_world_status,
    v_world_turn
  from
    public.worlds w
  where
    w.id = p_world_id
  for update;

  if v_world_status = 'archived' then
    raise exception 'world is archived and cannot be advanced'
      using errcode = 'P0001', hint = 'world_archived';
  end if;

  if v_world_turn is null or v_world_turn <> p_expected_turn_number then
    raise exception 'stale expected turn number'
      using errcode = 'P0001', hint = 'stale_expected_turn';
  end if;

  -- Look up the pre-created running transition by id.
  select
    tt.* into v_transition
  from
    public.turn_transitions tt
  where
    tt.id = p_transition_id;

  if not found or v_transition.world_id <> p_world_id then
    raise exception 'transition % not found for world %', p_transition_id, p_world_id
      using errcode = 'P0001';
  end if;

  if v_transition.status <> 'running' then
    raise exception 'transition % is not in running status (current: %)', p_transition_id, v_transition.status
      using errcode = 'P0001';
  end if;

  -- §C36: Cross-world payload guard (before the failure-capture block so validation
  -- failures leave the transition in 'running' status for retry).
  v_valid_settlement_ids := array(
    select s.id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
    where n.world_id = p_world_id
  );

  v_valid_resource_ids := array(
    select id from public.resources where world_id = p_world_id
  );

  v_valid_project_ids := array(
    select id from public.construction_projects
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_building_ids := array(
    select id from public.settlement_buildings
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_deposit_instance_ids := array(
    select id from public.deposit_instances
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_managed_pop_instance_ids := array(
    select id from public.managed_population_instances
    where settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_trade_route_ids := array(
    select id from public.trade_routes
    where origin_settlement_id = any(v_valid_settlement_ids)
      and destination_settlement_id = any(v_valid_settlement_ids)
  );

  v_valid_citizen_ids := array(
    select id from public.citizens where world_id = p_world_id
  );

  v_valid_building_blueprint_ids := array(
    select id from public.building_blueprints where world_id = p_world_id
  );

  v_valid_building_blueprint_tier_ids := array(
    select t.id from public.building_blueprint_tiers t
    join public.building_blueprints b on b.id = t.building_blueprint_id
    where b.world_id = p_world_id
  );

  v_valid_nation_ids := array(
    select id from public.nations where world_id = p_world_id
  );

  v_valid_treaty_ids := array(
    select id from public.nation_treaties where world_id = p_world_id
  );

  v_valid_currency_ids := array(
    select id from public.nation_currencies where world_id = p_world_id
  );

  v_valid_education_level_ids := array(
    select id from public.education_levels where world_id = p_world_id
  );

  v_valid_enrollment_ids := array(
    select id from public.education_enrollments where world_id = p_world_id
  );

  -- #1110: military upkeep phase id-sets.
  v_valid_army_ids := array(
    select id from public.armies where world_id = p_world_id
  );

  v_valid_army_unit_ids := array(
    select au.id from public.army_units au
    inner join public.armies a on a.id = au.army_id
    where a.world_id = p_world_id
  );

  v_valid_unit_soldier_ids := array(
    select id from public.unit_soldiers where world_id = p_world_id
  );

  for v_delta in
    select value from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
  loop
    v_check_id := (v_delta ->> 'settlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in stockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_delta ->> 'resourceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_resource_ids)) then
      raise exception 'cross-world id % in stockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'constructionUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'projectId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_project_ids)) then
      raise exception 'cross-world id % in constructionUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'buildingsCreated', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'settlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_update ->> 'buildingBlueprintId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_building_blueprint_ids)) then
      raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_update ->> 'currentTierId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_building_blueprint_tier_ids)) then
      raise exception 'cross-world id % in buildingsCreated', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'buildingStateChanges', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'buildingId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_building_ids)) then
      raise exception 'cross-world id % in buildingStateChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'depositUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'depositInstanceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_deposit_instance_ids)) then
      raise exception 'cross-world id % in depositUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_update ->> 'managedPopulationInstanceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_managed_pop_instance_ids)) then
      raise exception 'cross-world id % in managedPopulationUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_route_outcome in
    select value from jsonb_array_elements(coalesce(p_payload -> 'tradeRouteOutcomes', '[]'::jsonb))
  loop
    v_check_id := (v_route_outcome ->> 'tradeRouteId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_trade_route_ids)) then
      raise exception 'cross-world id % in tradeRouteOutcomes', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_backfill in
    select value from jsonb_array_elements(coalesce(p_payload -> 'bornOnTurnBackfill', '[]'::jsonb))
  loop
    v_check_id := (v_backfill ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in bornOnTurnBackfill', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_birth in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
  loop
    v_check_id := (v_birth ->> 'settlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_birth ->> 'parentACitizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_birth ->> 'parentBCitizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenBirths', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_death in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb))
  loop
    v_check_id := (v_death ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenDeaths', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_partnership_change in
    select value from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
  loop
    v_check_id := (v_partnership_change ->> 'citizenAId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in partnershipChanges', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_partnership_change ->> 'citizenBId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in partnershipChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_assignment_clear in
    select value from jsonb_array_elements(coalesce(p_payload -> 'assignmentClears', '[]'::jsonb))
  loop
    v_check_id := (v_assignment_clear ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in assignmentClears', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §1083: nationStockpileDeltas / nationTurnSnapshots cross-world guards.
  for v_delta in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationStockpileDeltas', '[]'::jsonb))
  loop
    v_check_id := (v_delta ->> 'nationId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_nation_ids)) then
      raise exception 'cross-world id % in nationStockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_delta ->> 'resourceId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_resource_ids)) then
      raise exception 'cross-world id % in nationStockpileDeltas', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_nation_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationTurnSnapshots', '[]'::jsonb))
  loop
    v_check_id := (v_nation_snapshot ->> 'nationId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_nation_ids)) then
      raise exception 'cross-world id % in nationTurnSnapshots', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §1090: treatyStatusChanges cross-world guard.
  for v_treaty_change in
    select value from jsonb_array_elements(coalesce(p_payload -> 'treatyStatusChanges', '[]'::jsonb))
  loop
    v_check_id := (v_treaty_change ->> 'treatyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_treaty_ids)) then
      raise exception 'cross-world id % in treatyStatusChanges', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- §1094: nationCurrencySnapshots / nationCurrencyUpdates cross-world guards.
  for v_currency_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencySnapshots', '[]'::jsonb))
  loop
    v_check_id := (v_currency_snapshot ->> 'nationId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_nation_ids)) then
      raise exception 'cross-world id % in nationCurrencySnapshots', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_currency_snapshot ->> 'currencyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_currency_ids)) then
      raise exception 'cross-world id % in nationCurrencySnapshots', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_currency_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencyUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_currency_update ->> 'currencyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_currency_ids)) then
      raise exception 'cross-world id % in nationCurrencyUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- #1104: citizenEducationPatches / enrollmentProgressUpdates /
  -- enrollmentGraduations cross-world guards.
  for v_citizen_education_patch in
    select value from jsonb_array_elements(coalesce(p_payload -> 'citizenEducationPatches', '[]'::jsonb))
  loop
    v_check_id := (v_citizen_education_patch ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in citizenEducationPatches', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_citizen_education_patch ->> 'educationLevelId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_education_level_ids)) then
      raise exception 'cross-world id % in citizenEducationPatches', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_enrollment_progress_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'enrollmentProgressUpdates', '[]'::jsonb))
  loop
    v_check_id := (v_enrollment_progress_update ->> 'enrollmentId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_enrollment_ids)) then
      raise exception 'cross-world id % in enrollmentProgressUpdates', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_enrollment_progress_update ->> 'targetLevelId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_education_level_ids)) then
      raise exception 'cross-world id % in enrollmentProgressUpdates', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_enrollment_graduation in
    select value from jsonb_array_elements(coalesce(p_payload -> 'enrollmentGraduations', '[]'::jsonb))
  loop
    v_check_id := (v_enrollment_graduation ->> 'enrollmentId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_enrollment_ids)) then
      raise exception 'cross-world id % in enrollmentGraduations', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- #1110: armyTurnSnapshots / desertedSoldiers / disbandedUnits cross-world guards.
  for v_army_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'armyTurnSnapshots', '[]'::jsonb))
  loop
    v_check_id := (v_army_snapshot ->> 'armyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_ids)) then
      raise exception 'cross-world id % in armyTurnSnapshots', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_deserted_soldier in
    select value from jsonb_array_elements(coalesce(p_payload -> 'desertedSoldiers', '[]'::jsonb))
  loop
    v_check_id := (v_deserted_soldier ->> 'citizenId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_citizen_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_deserted_soldier ->> 'newSettlementId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_settlement_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_deserted_soldier ->> 'soldierId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_unit_soldier_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_deserted_soldier ->> 'unitId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_unit_ids)) then
      raise exception 'cross-world id % in desertedSoldiers', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  for v_disbanded_unit in
    select value from jsonb_array_elements(coalesce(p_payload -> 'disbandedUnits', '[]'::jsonb))
  loop
    v_check_id := (v_disbanded_unit ->> 'armyId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_ids)) then
      raise exception 'cross-world id % in disbandedUnits', v_check_id using errcode = 'P0001';
    end if;
    v_check_id := (v_disbanded_unit ->> 'unitId')::uuid;
    if v_check_id is not null and not (v_check_id = any(v_valid_army_unit_ids)) then
      raise exception 'cross-world id % in disbandedUnits', v_check_id using errcode = 'P0001';
    end if;
  end loop;

  -- #1111: deceasedSoldierIds cross-world guard.
  for v_deceased_soldier_id in
    select value::uuid
    from jsonb_array_elements_text(coalesce(p_payload -> 'deceasedSoldierIds', '[]'::jsonb))
  loop
    if not (v_deceased_soldier_id = any(v_valid_unit_soldier_ids)) then
      raise exception 'cross-world id % in deceasedSoldierIds', v_deceased_soldier_id using errcode = 'P0001';
    end if;
  end loop;

  -- §H9: Stockpile quantityBefore re-validation (issue #506).
  for v_delta in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
  loop
    v_settlement_id   := (v_delta ->> 'settlementId')::uuid;
    v_resource_id     := (v_delta ->> 'resourceId')::uuid;
    v_quantity_before := coalesce((v_delta ->> 'quantityBefore')::numeric, 0);

    select srs.quantity
    into v_actual_quantity
    from public.settlement_resource_stockpiles srs
    where srs.settlement_id = v_settlement_id
      and srs.resource_id = v_resource_id;

    if found and v_actual_quantity <> v_quantity_before then
      raise exception 'state diverged: stockpile (%,%) was % but payload claimed %',
        v_settlement_id, v_resource_id, v_actual_quantity, v_quantity_before
        using errcode = 'P0001', hint = 'state_drifted';
    end if;
  end loop;

  -- §H10a: Deposit resource remainingQuantityBefore re-validation (issue #670).
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'depositUpdates', '[]'::jsonb))
  loop
    v_deposit_instance_id := (v_update ->> 'depositInstanceId')::uuid;

    for v_resource_delta in
      select value
      from jsonb_array_elements(coalesce(v_update -> 'resourceDeltas', '[]'::jsonb))
    loop
      -- Only re-validate when the payload explicitly carries the before-value;
      -- omitting it opts out of drift detection for that delta.
      if v_resource_delta ? 'remainingQuantityBefore' then
        v_resource_id             := (v_resource_delta ->> 'resourceId')::uuid;
        v_remaining_quantity_before := (v_resource_delta ->> 'remainingQuantityBefore')::numeric;

        select dir.remaining_quantity
        into v_actual_remaining_quantity
        from public.deposit_instance_resources dir
        where dir.deposit_instance_id = v_deposit_instance_id
          and dir.resource_id = v_resource_id;

        if found and v_actual_remaining_quantity <> v_remaining_quantity_before then
          raise exception 'state diverged: deposit resource (%,%) was % but payload claimed %',
            v_deposit_instance_id, v_resource_id, v_actual_remaining_quantity, v_remaining_quantity_before
            using errcode = 'P0001', hint = 'state_drifted';
        end if;
      end if;
    end loop;
  end loop;

  -- §H10b: Managed-population currentCountBefore re-validation (issue #670).
  for v_update in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'managedPopulationUpdates', '[]'::jsonb))
  loop
    -- Only re-validate when the payload explicitly carries the before-value.
    if v_update ? 'currentCountBefore' then
      v_managed_pop_instance_id := (v_update ->> 'managedPopulationInstanceId')::uuid;
      v_current_count_before    := (v_update ->> 'currentCountBefore')::numeric;

      select mpi.current_count
      into v_actual_current_count
      from public.managed_population_instances mpi
      where mpi.id = v_managed_pop_instance_id;

      if found and v_actual_current_count <> v_current_count_before then
        raise exception 'state diverged: managed-population % was % but payload claimed %',
          v_managed_pop_instance_id, v_actual_current_count, v_current_count_before
          using errcode = 'P0001', hint = 'state_drifted';
      end if;
    end if;
  end loop;

  -- Outer failure-capture block: any unhandled exception inside marks the transition
  -- failed so callers can distinguish a partial run from success.
  begin
    -- §C28
    v_stockpile_delta_count := public.internal_apply_turn_transition_stockpile_deltas (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §C29
    select
      construction_update_count,
      buildings_created_count,
      building_state_change_count
    into
      v_construction_update_count,
      v_buildings_created_count,
      v_building_state_change_count
    from public.internal_apply_turn_transition_construction_patches (
      v_transition.id, v_transition.to_turn_number, p_payload
    );

    -- §C30
    select
      deposit_update_count,
      managed_pop_update_count
    into
      v_deposit_update_count,
      v_managed_pop_update_count
    from public.internal_apply_turn_transition_deposit_managed_pop_patches (p_payload);

    -- §C31
    v_trade_route_outcome_count := public.internal_apply_turn_transition_trade_route_patches (p_payload);

    -- §C32
    select
      backfill_count,
      citizen_birth_count,
      citizen_death_count,
      partnership_change_count,
      assignment_clear_count,
      overshoot_stamp_count
    into
      v_backfill_count,
      v_citizen_birth_count,
      v_citizen_death_count,
      v_partnership_change_count,
      v_assignment_clear_count,
      v_overshoot_stamp_count
    from public.internal_apply_turn_transition_citizen_partnership_patches (
      p_world_id, v_transition.id, p_payload
    );

    -- §C32.5 event status patches + citizen memories
    select event_status_update_count, citizen_memory_count
    into v_event_status_update_count, v_citizen_memory_count
    from public.internal_apply_turn_transition_event_patches(
      p_world_id, v_transition.id, v_transition.to_turn_number, p_payload
    );

    -- §C33
    select
      log_entry_count,
      notification_count
    into
      v_log_entry_count,
      v_notification_count
    from public.internal_apply_turn_transition_log_entries_and_notifications (
      v_transition.id, p_world_id, p_payload
    );

    -- §C34
    v_settlement_snapshot_count := public.internal_apply_turn_transition_settlement_snapshots (
      v_transition.id, p_world_id, p_payload
    );

    -- §C37: nation economy — credit/debit nation_resource_stockpiles (tax
    -- collection and treaty tribute alike), persist nation_turn_snapshots
    -- (issues #1083, #1090).
    select
      nation_stockpile_delta_count,
      nation_turn_snapshot_count
    into
      v_nation_stockpile_delta_count,
      v_nation_turn_snapshot_count
    from public.internal_apply_turn_transition_nation_economy (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §C38: nation currency — persist nation_currency_snapshots, update
    -- nation_currencies.confidence, and insert currency.default /
    -- currency.confidence_collapsing notifications (issue #1094).
    select
      nation_currency_snapshot_count,
      nation_currency_update_count,
      nation_currency_notification_count
    into
      v_nation_currency_snapshot_count,
      v_nation_currency_update_count,
      v_nation_currency_notification_count
    from public.internal_apply_turn_transition_nation_currency (
      v_transition.id, p_world_id, p_expected_turn_number, p_payload
    );

    -- §1090: treaty status changes — flip expired treaties.
    v_treaty_status_change_count := public.internal_apply_turn_transition_treaty_patches (p_payload);

    -- #1104: education — citizen education-level patches, enrollment
    -- progress updates, and enrollment graduations.
    select
      citizen_education_patch_count,
      enrollment_progress_update_count,
      enrollment_graduation_count
    into
      v_citizen_education_patch_count,
      v_enrollment_progress_update_count,
      v_enrollment_graduation_count
    from public.internal_apply_turn_transition_education_patches (p_payload);

    -- #1110/#1111: military upkeep — army_turn_snapshots, deserted-soldier
    -- civilian-return + unit_soldiers cleanup, deceased-soldier cleanup, and
    -- unit disband.
    select
      army_turn_snapshot_count,
      deserted_soldier_count,
      disbanded_unit_count,
      deceased_soldier_count
    into
      v_army_turn_snapshot_count,
      v_deserted_soldier_count,
      v_disbanded_unit_count,
      v_deceased_soldier_count
    from public.internal_apply_turn_transition_military_upkeep (
      p_world_id, v_transition.to_turn_number, p_payload
    );

    -- #1119: law amendments — expire any 'proposed' amendment whose deadline
    -- has been reached by the new turn.
    select
      amendment_expired_count,
      amendment_notification_count
    into
      v_amendment_expired_count,
      v_amendment_expiry_notification_count
    from public.internal_apply_turn_transition_law_amendment_expiry (
      v_transition.id, p_world_id, v_transition.to_turn_number
    );

    -- #1123: office terms — archive any active office whose fixed term has
    -- expired by the new turn.
    select
      office_term_expired_count,
      office_term_expiry_notification_count
    into
      v_office_term_expired_count,
      v_office_term_expiry_notification_count
    from public.internal_apply_turn_transition_office_term_expiry (
      v_transition.id, p_world_id, v_transition.to_turn_number
    );

    -- §C35 / §1076: advance world turn, reset settlement readiness, clear
    -- nation readiness votes and computed readiness for the departing turn.
    select
      settlement_readiness_reset_count,
      nation_readiness_reset_count,
      nation_readiness_votes_cleared_count
    into
      v_readiness_reset_count,
      v_nation_readiness_reset_count,
      v_nation_readiness_votes_cleared_count
    from public.internal_apply_turn_transition_advance_world_turn (
      p_world_id, p_expected_turn_number
    );

    update public.turn_transitions
    set
      status                  = 'completed',
      finished_at             = now (),
      readiness_summary_jsonb = p_payload -> 'readinessSummary',
      forecast_snapshot_jsonb = p_forecast_snapshot_jsonb
    where
      public.turn_transitions.id = v_transition.id
    returning
      * into v_transition;

    v_result := jsonb_build_object (
      'transitionId',      v_transition.id,
      'fromTurnNumber',    v_transition.from_turn_number,
      'toTurnNumber',      v_transition.to_turn_number,
      'currentTurnNumber', p_expected_turn_number + 1,
      'patchCounts',
      jsonb_build_object (
        'stockpileDeltas',            v_stockpile_delta_count,
        'constructionUpdates',        v_construction_update_count,
        'buildingsCreated',           v_buildings_created_count,
        'buildingStateChanges',       v_building_state_change_count,
        'depositUpdates',             v_deposit_update_count,
        'managedPopulationUpdates',   v_managed_pop_update_count,
        'tradeRouteOutcomes',         v_trade_route_outcome_count,
        'bornOnTurnBackfill',         v_backfill_count,
        'citizenBirths',              v_citizen_birth_count,
        'citizenDeaths',              v_citizen_death_count,
        'partnershipChanges',         v_partnership_change_count,
        'assignmentClears',           v_assignment_clear_count,
        'overshootStamped',           v_overshoot_stamp_count,
        'eventStatusUpdates',         v_event_status_update_count,
        'citizenMemories',            v_citizen_memory_count,
        'logEntries',                 v_log_entry_count,
        'notifications',              v_notification_count,
        'settlementSnapshots',        v_settlement_snapshot_count,
        'readinessReset',             v_readiness_reset_count,
        'nationReadinessReset',       v_nation_readiness_reset_count,
        'nationReadinessVotesCleared', v_nation_readiness_votes_cleared_count,
        'nationStockpileDeltas',      v_nation_stockpile_delta_count,
        'nationTurnSnapshots',        v_nation_turn_snapshot_count,
        'treatyStatusChanges',        v_treaty_status_change_count,
        'nationCurrencySnapshots',    v_nation_currency_snapshot_count,
        'nationCurrencyUpdates',      v_nation_currency_update_count,
        'nationCurrencyNotifications', v_nation_currency_notification_count,
        'citizenEducationPatches',    v_citizen_education_patch_count,
        'enrollmentProgressUpdates',  v_enrollment_progress_update_count,
        'enrollmentGraduations',      v_enrollment_graduation_count,
        'armyTurnSnapshots',          v_army_turn_snapshot_count,
        'desertedSoldiers',           v_deserted_soldier_count,
        'disbandedUnits',             v_disbanded_unit_count,
        'deceasedSoldierIds',         v_deceased_soldier_count,
        'lawAmendmentsExpired',       v_amendment_expired_count,
        'lawAmendmentExpiryNotifications', v_amendment_expiry_notification_count,
        'officeTermsExpired',         v_office_term_expired_count,
        'officeTermExpiryNotifications', v_office_term_expiry_notification_count
      )
    );
  exception
    when others then
      update public.turn_transitions
      set
        status = 'failed'
      where
        public.turn_transitions.id = v_transition.id
        and public.turn_transitions.status = 'running';

      raise;
  end;

  return v_result;
end;
$$;

revoke all on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb)
from
  public;

revoke
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb)
from
  anon,
  authenticated;

grant
execute on function public.apply_turn_transition (uuid, integer, jsonb, uuid, jsonb) to service_role;
