-- Migration: restrict_child_domain_writes
-- Limits browser-authenticated writes on public.nations and public.settlements
-- to explicit user-editable columns. Scope columns (nations.world_id,
-- settlements.nation_id) become INSERT-only, so admins cannot relocate rows
-- across worlds/nations through the table API. System timestamps, readiness
-- state, and the placeholder ready_set_by_citizen_id column become unreachable
-- through direct REST calls; readiness state is now mutated exclusively through
-- the SECURITY DEFINER helpers defined below, while system timestamps remain
-- writable only by privileged database paths (e.g. the set_updated_at trigger
-- and advance_world_turn_if_current). Column-level privileges are checked
-- before RLS, so the restriction applies independently of policy logic and
-- future columns added to these tables stay locked down by default.
-- ---------------------------------------------------------------------------
-- nations: narrow direct INSERT/UPDATE to explicit user-editable columns.
-- ---------------------------------------------------------------------------
revoke insert,
update on public.nations
from
  authenticated;

grant insert (id, world_id, name, description, is_hidden) on public.nations to authenticated;

grant
update (name, description, is_hidden) on public.nations to authenticated;

-- ---------------------------------------------------------------------------
-- settlements: narrow direct INSERT/UPDATE to explicit user-editable columns.
-- ---------------------------------------------------------------------------
revoke insert,
update on public.settlements
from
  authenticated;

grant insert (
  id,
  nation_id,
  name,
  description,
  coord_x,
  coord_z
) on public.settlements to authenticated;

grant
update (name, description, coord_x, coord_z) on public.settlements to authenticated;

-- ---------------------------------------------------------------------------
-- set_settlement_readiness: marks a settlement ready or not-ready for the
-- current turn. Replaces direct UPDATEs to is_ready_current_turn, ready_set_at,
-- and last_ready_at by browser callers. SECURITY DEFINER so column grants
-- above do not block the privileged write; the function re-checks world admin
-- access and archived-world state before writing.
-- ---------------------------------------------------------------------------
create or replace function public.set_settlement_readiness (p_settlement_id uuid, p_is_ready boolean) returns table (
  id uuid,
  is_ready_current_turn boolean,
  ready_set_at timestamptz,
  last_ready_at timestamptz
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
begin
  if p_settlement_id is null or p_is_ready is null then
    return;
  end if;

  select
    n.world_id,
    w.status,
    w.archived_at
  into v_world_id, v_world_status, v_world_archived_at
  from
    public.settlements s
    inner join public.nations n on n.id = s.nation_id
    inner join public.worlds w on w.id = n.world_id
  where
    s.id = p_settlement_id;

  if v_world_id is null then
    return;
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    return;
  end if;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    return;
  end if;

  return query
  update public.settlements s
  set
    is_ready_current_turn = p_is_ready,
    ready_set_at = case
      when p_is_ready then now()
      else null
    end,
    last_ready_at = case
      when p_is_ready then now()
      else s.last_ready_at
    end
  where
    s.id = p_settlement_id
  returning
    s.id,
    s.is_ready_current_turn,
    s.ready_set_at,
    s.last_ready_at;
end;
$$;

revoke all on function public.set_settlement_readiness (uuid, boolean)
from
  public;

grant
execute on function public.set_settlement_readiness (uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- set_settlement_auto_ready: toggles auto-readiness for a settlement. Replaces
-- direct UPDATEs to auto_ready_enabled by browser callers. Same access gate as
-- set_settlement_readiness.
-- ---------------------------------------------------------------------------
create or replace function public.set_settlement_auto_ready (
  p_settlement_id uuid,
  p_auto_ready_enabled boolean
) returns table (
  id uuid,
  auto_ready_enabled boolean,
  is_ready_current_turn boolean,
  ready_set_at timestamptz
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
begin
  if p_settlement_id is null or p_auto_ready_enabled is null then
    return;
  end if;

  select
    n.world_id,
    w.status,
    w.archived_at
  into v_world_id, v_world_status, v_world_archived_at
  from
    public.settlements s
    inner join public.nations n on n.id = s.nation_id
    inner join public.worlds w on w.id = n.world_id
  where
    s.id = p_settlement_id;

  if v_world_id is null then
    return;
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    return;
  end if;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    return;
  end if;

  return query
  update public.settlements s
  set
    auto_ready_enabled = p_auto_ready_enabled
  where
    s.id = p_settlement_id
  returning
    s.id,
    s.auto_ready_enabled,
    s.is_ready_current_turn,
    s.ready_set_at;
end;
$$;

revoke all on function public.set_settlement_auto_ready (uuid, boolean)
from
  public;

grant
execute on function public.set_settlement_auto_ready (uuid, boolean) to authenticated;
