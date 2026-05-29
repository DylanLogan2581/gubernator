-- Migration: add_partnership_end_turn_constraint
-- Adds a CHECK constraint ensuring ended_on_turn_number >= formed_on_turn_number
-- when the partnership has a terminal status. Also tightens the three mutation
-- RPCs (end_partnership_internal, reassign_partner) to return zero rows as
-- defense-in-depth before the constraint fires.
-- ---------------------------------------------------------------------------
-- Table constraint
-- ---------------------------------------------------------------------------
alter table public.partnerships
add constraint partnerships_ended_on_turn_after_formed_check check (
  ended_on_turn_number is null
  or ended_on_turn_number >= formed_on_turn_number
);

-- ---------------------------------------------------------------------------
-- end_partnership_internal: reject when ended turn precedes formed turn
-- ---------------------------------------------------------------------------
create or replace function public.end_partnership_internal (
  p_partnership_id uuid,
  p_terminal_status text,
  p_ended_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid,
  p_log_category text
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_existing public.partnerships%rowtype;
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_actor_id uuid;
  v_updated public.partnerships%rowtype;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    return;
  end if;

  if p_partnership_id is null or p_turn_transition_id is null then
    return;
  end if;

  if p_terminal_status not in ('dissolved', 'widowed') then
    return;
  end if;

  if p_ended_on_turn_number is null or p_ended_on_turn_number < 0 then
    return;
  end if;

  if p_change_reason is null or btrim(p_change_reason) = '' then
    return;
  end if;

  select * into v_existing from public.partnerships where id = p_partnership_id;
  if v_existing.id is null then
    return;
  end if;

  if v_existing.status <> 'active' then
    return;
  end if;

  if p_ended_on_turn_number < v_existing.formed_on_turn_number then
    return;
  end if;

  select c.world_id into v_world_id
  from public.citizens c
  where c.id = v_existing.citizen_a_id;

  if v_world_id is null then
    return;
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
  ) then
    return;
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    return;
  end if;

  if not exists (
    select 1
    from public.turn_transitions tt
    where tt.id = p_turn_transition_id
      and tt.world_id = v_world_id
  ) then
    return;
  end if;

  update public.partnerships p
  set
    status = p_terminal_status,
    ended_on_turn_number = p_ended_on_turn_number,
    changed_by_user_id = v_actor_id,
    change_reason = p_change_reason
  where p.id = p_partnership_id
  returning * into v_updated;

  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    citizen_id,
    log_category,
    payload_jsonb
  ) values (
    p_turn_transition_id,
    v_world_id,
    v_existing.citizen_a_id,
    p_log_category,
    jsonb_build_object(
      'partnership_id', v_updated.id,
      'citizen_a_id', v_updated.citizen_a_id,
      'citizen_b_id', v_updated.citizen_b_id,
      'status', v_updated.status,
      'formed_on_turn_number', v_updated.formed_on_turn_number,
      'ended_on_turn_number', v_updated.ended_on_turn_number,
      'change_reason', p_change_reason,
      'changed_by_user_id', v_actor_id
    )
  );

  return next v_updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- reassign_partner: reject when ended turn precedes the old partnership's
-- formed turn
-- ---------------------------------------------------------------------------
create or replace function public.reassign_partner (
  p_old_partnership_id uuid,
  p_retained_citizen_id uuid,
  p_new_partner_citizen_id uuid,
  p_ended_on_turn_number integer,
  p_formed_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_existing public.partnerships%rowtype;
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_actor_id uuid;
  v_new_partner public.citizens%rowtype;
  v_retained public.citizens%rowtype;
  v_dissolved public.partnerships%rowtype;
  v_created public.partnerships%rowtype;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    return;
  end if;

  if p_old_partnership_id is null
    or p_retained_citizen_id is null
    or p_new_partner_citizen_id is null
    or p_turn_transition_id is null
  then
    return;
  end if;

  if p_retained_citizen_id = p_new_partner_citizen_id then
    return;
  end if;

  if p_ended_on_turn_number is null
    or p_formed_on_turn_number is null
    or p_ended_on_turn_number < 0
    or p_formed_on_turn_number < 0
  then
    return;
  end if;

  if p_change_reason is null or btrim(p_change_reason) = '' then
    return;
  end if;

  select * into v_existing from public.partnerships where id = p_old_partnership_id;
  if v_existing.id is null or v_existing.status <> 'active' then
    return;
  end if;

  if p_ended_on_turn_number < v_existing.formed_on_turn_number then
    return;
  end if;

  if p_retained_citizen_id <> v_existing.citizen_a_id
    and p_retained_citizen_id <> v_existing.citizen_b_id
  then
    return;
  end if;

  select * into v_retained from public.citizens where id = p_retained_citizen_id;
  select * into v_new_partner from public.citizens where id = p_new_partner_citizen_id;
  if v_retained.id is null or v_new_partner.id is null then
    return;
  end if;

  if v_retained.world_id <> v_new_partner.world_id then
    return;
  end if;

  v_world_id := v_retained.world_id;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
  ) then
    return;
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    return;
  end if;

  if v_retained.status <> 'alive' or v_new_partner.status <> 'alive' then
    return;
  end if;

  if not exists (
    select 1
    from public.turn_transitions tt
    where tt.id = p_turn_transition_id
      and tt.world_id = v_world_id
  ) then
    return;
  end if;

  update public.partnerships p
  set
    status = 'dissolved',
    ended_on_turn_number = p_ended_on_turn_number,
    changed_by_user_id = v_actor_id,
    change_reason = p_change_reason
  where p.id = p_old_partnership_id
  returning * into v_dissolved;

  insert into public.partnerships (
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number,
    changed_by_user_id,
    change_reason
  ) values (
    p_retained_citizen_id,
    p_new_partner_citizen_id,
    'active',
    p_formed_on_turn_number,
    v_actor_id,
    p_change_reason
  ) returning * into v_created;

  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    citizen_id,
    log_category,
    payload_jsonb
  ) values (
    p_turn_transition_id,
    v_world_id,
    p_retained_citizen_id,
    'partnership_reassigned',
    jsonb_build_object(
      'dissolved_partnership_id', v_dissolved.id,
      'created_partnership_id', v_created.id,
      'retained_citizen_id', p_retained_citizen_id,
      'new_partner_citizen_id', p_new_partner_citizen_id,
      'previous_partner_citizen_id', case
        when v_existing.citizen_a_id = p_retained_citizen_id then v_existing.citizen_b_id
        else v_existing.citizen_a_id
      end,
      'ended_on_turn_number', p_ended_on_turn_number,
      'formed_on_turn_number', p_formed_on_turn_number,
      'change_reason', p_change_reason,
      'changed_by_user_id', v_actor_id
    )
  );

  -- Return the newly-formed partnership row. Callers that need the dissolved
  -- row can refetch via the list-for-citizen query.
  return next v_created;
end;
$$;
