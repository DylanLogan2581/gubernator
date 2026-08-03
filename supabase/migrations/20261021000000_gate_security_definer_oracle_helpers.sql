-- Migration: gate_security_definer_oracle_helpers
-- #1143: nations_have_met, nation_world_id, and resolve_government_body_
-- member_ids are SECURITY DEFINER (bypass RLS) and granted to every
-- authenticated user with no world-access check, letting a caller who knows
-- (or guesses) a uuid probe/enumerate nation discovery state, nation->world
-- mapping, or government body member citizen ids in a world they have no
-- access to.
--
-- Gate all three on current_user_has_world_access, but only when the call is
-- happening inside an authenticated end-user session (auth.uid() is not
-- null). nations_have_met and resolve_government_body_member_ids are also
-- used as data-integrity checks by triggers/RPCs invoked with no JWT session
-- (migrations, service-role/system callers -- see AGENTS.md: "service-role
-- clients bypass RLS but have no auth.uid()"), where the gate must not apply
-- so those invariant checks keep their original behavior.
-- ---------------------------------------------------------------------------
-- nations_have_met: require the caller to have world access to the (shared)
-- world of both nations, when called with a real session. The a = b
-- short-circuit is left ungated -- it reveals nothing beyond "these two
-- uuids are equal".
-- ---------------------------------------------------------------------------
create or replace function public.nations_have_met (a uuid, b uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    a = b
    or exists (
      select 1
      from public.nation_discoveries nd
      join public.nations na on na.id = a
      join public.nations nb on nb.id = b
      where nd.nation_a_id = least(a, b)
        and nd.nation_b_id = greatest(a, b)
        and na.world_id = nb.world_id
        and (
          auth.uid () is null
          or public.current_user_has_world_access (na.world_id)
        )
    )
$$;

-- ---------------------------------------------------------------------------
-- nation_world_id: only resolve world_id when the caller already has access
-- to that world. Existing internal callers (e.g. settlements RLS policies)
-- immediately re-check current_user_has_world_access(nation_world_id(...))
-- on the result, so a caller with access sees no behavior change; a caller
-- without access now gets null instead of a real world_id. Only referenced
-- from RLS policies evaluated in an authenticated session, so no auth.uid()
-- is null bypass is needed here.
-- ---------------------------------------------------------------------------
create or replace function public.nation_world_id (p_nation_id uuid) returns uuid language sql stable security definer
set
  search_path = '' as $$
  select world_id
  from public.nations
  where id = p_nation_id
    and public.current_user_has_world_access (world_id)
$$;

-- ---------------------------------------------------------------------------
-- resolve_government_body_member_ids: require the caller to have world
-- access to the body's world before resolving membership, when called with
-- a real session. Internal callers (propose/second/vote on law amendments)
-- are invoked by a citizen already tied to that world, so behavior is
-- unaffected for them.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_government_body_member_ids (p_body_id uuid) returns setof uuid language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_nation_id uuid;
  v_settlement_id uuid;
  v_composition jsonb;
  v_entry jsonb;
  v_kind text;
  v_member_ids uuid[] := '{}';
begin
  select world_id, nation_id, settlement_id, composition_json
  into v_world_id, v_nation_id, v_settlement_id, v_composition
  from public.government_bodies
  where id = p_body_id;

  if not found or (
    auth.uid () is not null
    and not public.current_user_has_world_access (v_world_id)
  ) then
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
        select c.id
        from jsonb_array_elements_text(v_entry -> 'citizen_ids') as elem
        inner join public.citizens c on c.id = elem::uuid
        left join public.settlements s on s.id = c.settlement_id
        where c.world_id = v_world_id
          and (
            (v_nation_id is not null and s.nation_id = v_nation_id)
            or (v_settlement_id is not null and c.settlement_id = v_settlement_id)
          )
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

-- Grants are unchanged (already authenticated on all three); the body edits
-- above are the gate.
