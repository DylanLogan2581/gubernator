-- Migration: add_partnership_mutations
-- Adds the SECURITY DEFINER RPCs that govern admin-driven partnership writes
-- and pair every write with a turn_log_entries row so the audit trail matches
-- the rest of the audit model. Direct authenticated inserts/updates to
-- partnerships remain available via the RLS policies in
-- 20260520000002_add_partnerships.sql, but those paths cannot also touch
-- turn_log_entries (browser writes were revoked in
-- 20260519000001_protect_turn_audit_writes.sql), so the data layer routes
-- partnership writes through these RPCs.
--
-- Each RPC:
--   • Verifies the caller is super admin or world admin of the citizens'
--     world. Nation Manager / Settlement Manager scopes do not extend to
--     partnership edits in this epic.
--   • Requires p_turn_transition_id to belong to the partnership's world so
--     the turn log entry is scoped correctly.
--   • Stamps changed_by_user_id from auth.uid() and writes p_change_reason
--     verbatim onto the partnership row.
--   • Inserts exactly one turn_log_entries row with a partnership-specific
--     log_category and a structured payload.
--
-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.partnership_admin_can_write (p_citizen_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.citizens c
    where c.id = p_citizen_id
      and (
        public.is_super_admin ()
        or public.is_world_admin (c.world_id)
      )
  )
$$;

revoke all on function public.partnership_admin_can_write (uuid)
from
  public;

grant
execute on function public.partnership_admin_can_write (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_partnership: admin-only. Inserts an active partnership for two
-- distinct, alive citizens in the same world. May also be used to back-fill
-- a widowed partnership for record-keeping; in that case p_status must be
-- 'widowed' and p_ended_on_turn_number must be supplied, and the dead-citizen
-- check is skipped.
-- ---------------------------------------------------------------------------
create or replace function public.create_partnership (
  p_citizen_a_id uuid,
  p_citizen_b_id uuid,
  p_formed_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid,
  p_status text default 'active',
  p_ended_on_turn_number integer default null
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_citizen_a public.citizens%rowtype;
  v_citizen_b public.citizens%rowtype;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_actor_id uuid;
  v_partnership public.partnerships%rowtype;
  v_status text;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    return;
  end if;

  if p_citizen_a_id is null or p_citizen_b_id is null then
    return;
  end if;

  if p_citizen_a_id = p_citizen_b_id then
    return;
  end if;

  if p_formed_on_turn_number is null or p_formed_on_turn_number < 0 then
    return;
  end if;

  if p_change_reason is null or btrim(p_change_reason) = '' then
    return;
  end if;

  if p_turn_transition_id is null then
    return;
  end if;

  v_status := coalesce(p_status, 'active');
  if v_status not in ('active', 'widowed') then
    return;
  end if;

  if v_status = 'active' and p_ended_on_turn_number is not null then
    return;
  end if;

  if v_status = 'widowed' and p_ended_on_turn_number is null then
    return;
  end if;

  select * into v_citizen_a from public.citizens where id = p_citizen_a_id;
  select * into v_citizen_b from public.citizens where id = p_citizen_b_id;

  if v_citizen_a.id is null or v_citizen_b.id is null then
    return;
  end if;

  if v_citizen_a.world_id <> v_citizen_b.world_id then
    return;
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_citizen_a.world_id)
  ) then
    return;
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_citizen_a.world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    return;
  end if;

  if v_status = 'active'
    and (v_citizen_a.status <> 'alive' or v_citizen_b.status <> 'alive')
  then
    return;
  end if;

  if not exists (
    select 1
    from public.turn_transitions tt
    where tt.id = p_turn_transition_id
      and tt.world_id = v_citizen_a.world_id
  ) then
    return;
  end if;

  -- The partial unique indexes on partnerships(status='active', citizen_a_id)
  -- and (status='active', citizen_b_id) will reject the insert if either
  -- citizen already participates in an active partnership.
  insert into public.partnerships (
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number,
    ended_on_turn_number,
    changed_by_user_id,
    change_reason
  ) values (
    p_citizen_a_id,
    p_citizen_b_id,
    v_status,
    p_formed_on_turn_number,
    p_ended_on_turn_number,
    v_actor_id,
    p_change_reason
  ) returning * into v_partnership;

  insert into public.turn_log_entries (
    turn_transition_id,
    world_id,
    citizen_id,
    log_category,
    payload_jsonb
  ) values (
    p_turn_transition_id,
    v_citizen_a.world_id,
    p_citizen_a_id,
    'partnership_created',
    jsonb_build_object(
      'partnership_id', v_partnership.id,
      'citizen_a_id', v_partnership.citizen_a_id,
      'citizen_b_id', v_partnership.citizen_b_id,
      'status', v_partnership.status,
      'formed_on_turn_number', v_partnership.formed_on_turn_number,
      'ended_on_turn_number', v_partnership.ended_on_turn_number,
      'change_reason', p_change_reason,
      'changed_by_user_id', v_actor_id
    )
  );

  return next v_partnership;
end;
$$;

revoke all on function public.create_partnership (uuid, uuid, integer, text, uuid, text, integer)
from
  public;

grant
execute on function public.create_partnership (uuid, uuid, integer, text, uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- end_partnership_internal: shared body for the dissolve / mark-widowed
-- transitions. Both paths terminate an active partnership row with a terminal
-- status and emit a paired turn log entry under the supplied log category.
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

revoke all on function public.end_partnership_internal (uuid, text, integer, text, uuid, text)
from
  public;

-- Internal helper only — no grant to authenticated. The dissolve and
-- mark-widowed RPCs invoke it via SECURITY DEFINER chaining.
-- ---------------------------------------------------------------------------
-- dissolve_partnership: admin-only. Sets the active partnership's status to
-- 'dissolved' and emits a turn log entry of category 'partnership_dissolved'.
-- ---------------------------------------------------------------------------
create or replace function public.dissolve_partnership (
  p_partnership_id uuid,
  p_ended_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
begin
  return query
  select * from public.end_partnership_internal (
    p_partnership_id,
    'dissolved',
    p_ended_on_turn_number,
    p_change_reason,
    p_turn_transition_id,
    'partnership_dissolved'
  );
end;
$$;

revoke all on function public.dissolve_partnership (uuid, integer, text, uuid)
from
  public;

grant
execute on function public.dissolve_partnership (uuid, integer, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_partnership_widowed: admin-only. Same shape as dissolve_partnership,
-- but stamps the terminal status as 'widowed' and emits a 'partnership_widowed'
-- log entry. Used when one partner has died; the calling layer is responsible
-- for first transitioning the dead citizen via mark_citizen_dead.
-- ---------------------------------------------------------------------------
create or replace function public.mark_partnership_widowed (
  p_partnership_id uuid,
  p_ended_on_turn_number integer,
  p_change_reason text,
  p_turn_transition_id uuid
) returns setof public.partnerships language plpgsql security definer
set
  search_path = '' as $$
begin
  return query
  select * from public.end_partnership_internal (
    p_partnership_id,
    'widowed',
    p_ended_on_turn_number,
    p_change_reason,
    p_turn_transition_id,
    'partnership_widowed'
  );
end;
$$;

revoke all on function public.mark_partnership_widowed (uuid, integer, text, uuid)
from
  public;

grant
execute on function public.mark_partnership_widowed (uuid, integer, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reassign_partner: admin-only. Dissolves the existing partnership and forms
-- a new active partnership pairing the retained citizen with the supplied
-- replacement partner. The shared p_change_reason is written to both
-- partnership rows and to a single 'partnership_reassigned' turn log entry so
-- the trail of "this was a correction" stays linked.
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

revoke all on function public.reassign_partner (uuid, uuid, uuid, integer, integer, text, uuid)
from
  public;

grant
execute on function public.reassign_partner (uuid, uuid, uuid, integer, integer, text, uuid) to authenticated;
