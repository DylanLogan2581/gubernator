-- Migration: add_nation_readiness_voting
-- Adds a nation-level readiness layer (#1075) on top of the existing
-- per-settlement readiness (public.settlements.is_ready_current_turn):
-- public.nation_turn_readiness holds the computed per-turn ready flag for a
-- nation, public.nation_readiness_votes holds the individual votes that
-- compute it. Government rules (src/shared/government/governmentTypes.ts,
-- GOVERNMENT_RULES) drive who may vote and how the votes combine:
--
--   monarchy / theocracy / despotism -> ruler_only        (nation_manager)
--   confederation                    -> settlement_managers_unanimous
--   republic                         -> office_majority    (senator offices)
--   tribal_council                   -> office_unanimous   (elder offices)
--
-- The office-based modes (republic, tribal_council) depend on an offices
-- schema that does not exist yet (tracked separately per the issue notes).
-- public.nation_readiness_eligible_voter_ids returns an empty set for those
-- two modes until that schema lands, so cast_nation_readiness_vote correctly
-- rejects every vote for them (no citizen can be an eligible voter of an
-- empty set) rather than silently misrepresenting who may vote. ruler_only
-- and confederation work standalone today.
-- ---------------------------------------------------------------------------
-- nation_turn_readiness
-- ---------------------------------------------------------------------------
create table public.nation_turn_readiness (
  id uuid primary key default gen_random_uuid(),
  nation_id uuid not null references public.nations (id) on delete cascade,
  world_id uuid not null references public.worlds (id) on delete cascade,
  turn_number integer not null,
  is_ready boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint nation_turn_readiness_turn_number_check check (turn_number >= 0),
  constraint nation_turn_readiness_unique unique (nation_id, turn_number)
);

create index nation_turn_readiness_world_id_idx on public.nation_turn_readiness (world_id);

create trigger nation_turn_readiness_set_updated_at before
update on public.nation_turn_readiness for each row
execute function public.set_updated_at ();

alter table public.nation_turn_readiness enable row level security;

create policy "nation_turn_readiness_select_world_access" on public.nation_turn_readiness for
select
  to authenticated using (public.current_user_has_world_access (world_id));

grant
select
  on public.nation_turn_readiness to authenticated;

-- ---------------------------------------------------------------------------
-- nation_readiness_votes
-- ---------------------------------------------------------------------------
create table public.nation_readiness_votes (
  id uuid primary key default gen_random_uuid(),
  nation_id uuid not null references public.nations (id) on delete cascade,
  turn_number integer not null,
  voter_citizen_id uuid not null references public.citizens (id) on delete cascade,
  vote boolean not null,
  cast_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint nation_readiness_votes_turn_number_check check (turn_number >= 0),
  constraint nation_readiness_votes_unique unique (nation_id, turn_number, voter_citizen_id)
);

create index nation_readiness_votes_nation_turn_idx on public.nation_readiness_votes (nation_id, turn_number);

alter table public.nation_readiness_votes enable row level security;

create policy "nation_readiness_votes_select_world_access" on public.nation_readiness_votes for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.nations n
      where
        n.id = nation_readiness_votes.nation_id
        and public.current_user_has_world_access (n.world_id)
    )
  );

grant
select
  on public.nation_readiness_votes to authenticated;

-- ---------------------------------------------------------------------------
-- nation_readiness_eligible_voter_ids: mirrors getReadinessVoters() in
-- src/shared/government/governmentSelectors.ts in SQL. Returns the citizen
-- ids currently eligible to cast a nation readiness vote for p_nation_id,
-- per its government_type's readiness mode.
-- ---------------------------------------------------------------------------
create or replace function public.nation_readiness_eligible_voter_ids (p_nation_id uuid) returns setof uuid language sql stable security definer
set
  search_path = '' as $$
  select c.id
  from public.nations n
  join public.citizens c
    on c.status = 'alive'
    and (
      (
        n.government_type in ('monarchy', 'theocracy', 'despotism')
        and c.role_type = 'nation_manager'
        and c.role_nation_id = n.id
      )
      or (
        n.government_type = 'confederation'
        and c.role_type = 'settlement_manager'
        and c.role_settlement_id in (
          select s.id from public.settlements s where s.nation_id = n.id
        )
      )
      -- republic (office_majority) and tribal_council (office_unanimous) are
      -- office-based modes with no eligible voters until the offices schema
      -- lands; they intentionally match no rows here.
    )
  where n.id = p_nation_id
$$;

revoke all on function public.nation_readiness_eligible_voter_ids (uuid)
from
  public;

grant
execute on function public.nation_readiness_eligible_voter_ids (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- recompute_nation_readiness: recomputes and upserts is_ready for
-- (p_nation_id, p_turn_number) from the votes currently in
-- nation_readiness_votes, per the nation's readiness mode:
--   ruler_only / office_unanimous / settlement_managers_unanimous -> ready
--     iff at least one eligible voter exists and every eligible voter's
--     vote is true.
--   office_majority -> ready iff true votes among eligible voters are a
--     strict majority (> half); false when there are no eligible voters.
-- Not exposed to authenticated; only called from cast_nation_readiness_vote.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_nation_readiness (p_nation_id uuid, p_turn_number integer) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_readiness_mode text;
  v_eligible_count integer;
  v_true_count integer;
  v_is_ready boolean;
begin
  select
    n.world_id,
    case n.government_type
      when 'republic' then 'office_majority'
      when 'tribal_council' then 'office_unanimous'
      when 'confederation' then 'settlement_managers_unanimous'
      else 'ruler_only'
    end
  into v_world_id, v_readiness_mode
  from public.nations n
  where n.id = p_nation_id;

  if v_world_id is null then
    return;
  end if;

  select count(*) into v_eligible_count
  from public.nation_readiness_eligible_voter_ids (p_nation_id);

  select count(*) into v_true_count
  from public.nation_readiness_votes rv
  where rv.nation_id = p_nation_id
    and rv.turn_number = p_turn_number
    and rv.vote
    and rv.voter_citizen_id in (
      select voter_id from public.nation_readiness_eligible_voter_ids (p_nation_id) as voter_id
    );

  if v_readiness_mode = 'office_majority' then
    v_is_ready := v_true_count::numeric > (v_eligible_count::numeric / 2);
  else
    v_is_ready := v_eligible_count > 0 and v_true_count = v_eligible_count;
  end if;

  insert into public.nation_turn_readiness (nation_id, world_id, turn_number, is_ready)
  values (p_nation_id, v_world_id, p_turn_number, v_is_ready)
  on conflict (nation_id, turn_number) do update
  set is_ready = excluded.is_ready, updated_at = now();
end;
$$;

revoke all on function public.recompute_nation_readiness (uuid, integer)
from
  public;

-- ---------------------------------------------------------------------------
-- cast_nation_readiness_vote: casts (or updates) a readiness vote for the
-- nation's current turn on behalf of p_voter_citizen_id, then recomputes
-- nation_turn_readiness.is_ready. Caller must be a world/super admin (may
-- vote for any voter citizen, covering NPC voters) or the user whose active
-- player character is p_voter_citizen_id. p_voter_citizen_id must be an
-- eligible voter for the nation's government type.
-- ---------------------------------------------------------------------------
create or replace function public.cast_nation_readiness_vote (
  p_nation_id uuid,
  p_voter_citizen_id uuid,
  p_vote boolean
) returns public.nation_readiness_votes language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_turn_number integer;
  v_is_eligible boolean;
  v_row public.nation_readiness_votes%rowtype;
begin
  if p_nation_id is null or p_voter_citizen_id is null or p_vote is null then
    raise exception 'nation, voter citizen, and vote are required'
      using errcode = '22023';
  end if;

  select n.world_id, w.current_turn_number
  into v_world_id, v_turn_number
  from public.nations n
  inner join public.worlds w on w.id = n.world_id
  where n.id = p_nation_id;

  if v_world_id is null then
    raise exception 'nation not found'
      using errcode = 'P0002';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
    or public.current_user_active_player_character_id (v_world_id) = p_voter_citizen_id
  ) then
    raise exception 'You can only cast a nation readiness vote for your own active player character.'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.nation_readiness_eligible_voter_ids (p_nation_id) as voter_id
    where voter_id = p_voter_citizen_id
  ) into v_is_eligible;

  if not v_is_eligible then
    raise exception 'This citizen is not an eligible voter for this nation.'
      using errcode = '42501';
  end if;

  insert into public.nation_readiness_votes (
    nation_id,
    turn_number,
    voter_citizen_id,
    vote,
    cast_by_user_id
  )
  values (p_nation_id, v_turn_number, p_voter_citizen_id, p_vote, auth.uid ())
  on conflict (nation_id, turn_number, voter_citizen_id) do update
  set vote = excluded.vote, cast_by_user_id = excluded.cast_by_user_id
  returning * into v_row;

  perform public.recompute_nation_readiness (p_nation_id, v_turn_number);

  return v_row;
end;
$$;

revoke all on function public.cast_nation_readiness_vote (uuid, uuid, boolean)
from
  public;

grant
execute on function public.cast_nation_readiness_vote (uuid, uuid, boolean) to authenticated;
