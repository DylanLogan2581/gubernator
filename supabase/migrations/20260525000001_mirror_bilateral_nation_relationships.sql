-- Migration: mirror_bilateral_nation_relationships
-- Adds a SECURITY DEFINER trigger that keeps the symmetric nation_relationship
-- row in sync whenever a bilateral stance (allied / non_aggression_pact) is
-- accepted or revoked, and a SECURITY DEFINER RPC for respond_to_bilateral.
--
-- Why an RPC for respond_to_bilateral:
--   When Nation B's manager accepts Nation A's proposal they need to update
--   the (from=A, to=B) row, but the existing RLS UPDATE policy only permits
--   writes where from_nation_id is the caller's managed nation. The RPC
--   bypasses RLS as the function owner and also fires the trigger below that
--   mirrors the bilateral state to the symmetric (from=B, to=A) row.
--
-- Why a trigger for mirroring:
--   The trigger covers ALL paths that change current_stance to or from a
--   bilateral value: the respond_to_bilateral RPC, the direct
--   withdrawFromBilateral client write (Nation A updating their own row), and
--   the setUnilateralStance client upsert overriding an existing bilateral.
--   A session-local flag (app.skip_bilateral_mirror) prevents the trigger
--   from recursively firing on its own writes.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Trigger function: mirror bilateral stance to the symmetric row.
-- ---------------------------------------------------------------------------
create or replace function public.mirror_bilateral_nation_relationship_stance () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if current_setting('app.skip_bilateral_mirror', true) = 'true' then
    return null;
  end if;

  perform set_config('app.skip_bilateral_mirror', 'true', true);

  if new.current_stance in ('allied', 'non_aggression_pact') then
    insert into
      public.nation_relationships (
        from_nation_id,
        to_nation_id,
        current_stance,
        pending_stance,
        pending_status,
        pending_changed_by_citizen_id
      )
    values
      (
        new.to_nation_id,
        new.from_nation_id,
        new.current_stance,
        null,
        null,
        null
      )
    on conflict (from_nation_id, to_nation_id) do update
    set
      current_stance = excluded.current_stance,
      pending_stance = null,
      pending_status = null,
      pending_changed_by_citizen_id = null;
  elsif tg_op = 'UPDATE'
    and old.current_stance in ('allied', 'non_aggression_pact')
    and new.current_stance not in ('allied', 'non_aggression_pact')
  then
    -- Clear the symmetric row back to neutral only when it still carries a
    -- bilateral stance. This handles both withdrawFromBilateral (direct
    -- client update) and setUnilateralStance overriding a bilateral.
    update public.nation_relationships
    set
      current_stance = 'neutral',
      pending_stance = null,
      pending_status = null,
      pending_changed_by_citizen_id = null
    where
      from_nation_id = new.to_nation_id
      and to_nation_id = new.from_nation_id
      and current_stance in ('allied', 'non_aggression_pact');
  end if;

  perform set_config('app.skip_bilateral_mirror', 'false', true);

  return null;
end;
$$;

revoke all on function public.mirror_bilateral_nation_relationship_stance ()
from
  public;

create trigger nation_relationships_mirror_bilateral_after
after insert
or
update on public.nation_relationships for each row
execute function public.mirror_bilateral_nation_relationship_stance ();

-- ---------------------------------------------------------------------------
-- respond_to_bilateral: accept or decline a pending bilateral proposal.
-- Authorized callers: super admin, world admin of the nations' world, or the
-- Nation Manager whose player_character governs p_to_nation_id (the
-- responding nation). Returns the updated proposer row on success, or an
-- empty set when authorization fails, no pending proposal exists, or the
-- inputs are invalid.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_bilateral (
  p_from_nation_id uuid,
  p_to_nation_id uuid,
  p_response text
) returns setof public.nation_relationships language plpgsql security definer
set
  search_path = '' as $$
declare
  v_proposal public.nation_relationships%rowtype;
  v_world_id uuid;
  v_updated public.nation_relationships%rowtype;
begin
  if p_from_nation_id is null
    or p_to_nation_id is null
    or p_from_nation_id = p_to_nation_id
  then
    return;
  end if;

  if p_response not in ('accepted', 'declined') then
    return;
  end if;

  select *
  into v_proposal
  from public.nation_relationships
  where
    from_nation_id = p_from_nation_id
    and to_nation_id = p_to_nation_id;

  if v_proposal.id is null
    or v_proposal.pending_stance is null
    or v_proposal.pending_status <> 'proposed'
  then
    return;
  end if;

  select n.world_id
  into v_world_id
  from public.nations n
  where n.id = p_from_nation_id;

  if v_world_id is null then
    return;
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.is_nation_manager_of (p_to_nation_id)
  ) then
    return;
  end if;

  if p_response = 'accepted' then
    update public.nation_relationships
    set
      current_stance = v_proposal.pending_stance,
      pending_status = 'accepted'
    where
      from_nation_id = p_from_nation_id
      and to_nation_id = p_to_nation_id
    returning *
    into v_updated;
    -- The mirror trigger fires on this UPDATE and upserts the symmetric row
    -- (from=p_to_nation_id, to=p_from_nation_id) with the same bilateral stance.
  else
    update public.nation_relationships
    set
      pending_stance = null,
      pending_status = 'declined'
    where
      from_nation_id = p_from_nation_id
      and to_nation_id = p_to_nation_id
    returning *
    into v_updated;
  end if;

  return next v_updated;
end;
$$;

revoke all on function public.respond_to_bilateral (uuid, uuid, text)
from
  public;

grant
execute on function public.respond_to_bilateral (uuid, uuid, text) to authenticated;
