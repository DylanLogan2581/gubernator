-- Migration: reset_relationships_and_treaties_on_unmeet
-- #1259: set_nations_unmet only removed the nation_discoveries row, leaving
-- nation_relationships and nation_treaties for the pair intact -- hidden by
-- RLS (visibility requires an existing discovery per
-- nation_visible_to_current_user / nation_relationships_select_visible) but
-- not reset, so re-meeting the pair resurrected the old stance and any
-- pending bilateral proposal. The original migration (20260910000000, lines
-- 101-107) documented this as an intentional non-cascade; this migration
-- reverses that decision now that un-meet is a real admin correction tool.
--
-- Domain decision: un-meeting is a hard reset, not a pause.
--   - nation_relationships: both directional rows for the pair (from=A/to=B
--     and from=B/to=A) are deleted outright rather than reset to neutral in
--     place, so a re-meet starts genuinely blank (current_stance defaults to
--     'neutral' via insert, not an update the caller has to remember to
--     make). Deleting does not fire nation_relationships_mirror_bilateral_after
--     (that trigger only runs AFTER INSERT OR UPDATE), so no mirror bookkeeping
--     is needed here.
--   - nation_treaties: a treaty is evidence the two nations dealt with each
--     other, so history is kept rather than deleted. Any treaty still live
--     (status 'proposed' or 'active') for the pair is force-terminated to
--     'broken' -- 'withdrawn' and 'declined' both imply a choice by one of
--     the treaty's own parties, which does not fit an admin-initiated
--     un-meet, whereas 'broken' already means "no longer in effect" without
--     implying who ended it.
-- ---------------------------------------------------------------------------
create or replace function public.set_nations_unmet (p_a uuid, p_b uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_other_world_id uuid;
begin
  if p_a is null or p_b is null then
    raise exception 'both nations are required'
      using errcode = '22023';
  end if;

  if p_a = p_b then
    raise exception 'a nation cannot be unmet from itself'
      using errcode = '22023';
  end if;

  select world_id into v_world_id from public.nations where id = p_a;
  select world_id into v_other_world_id from public.nations where id = p_b;

  if v_world_id is null or v_other_world_id is null then
    raise exception 'nation not found'
      using errcode = 'P0002';
  end if;

  if v_world_id <> v_other_world_id then
    raise exception 'both nations must belong to the same world'
      using errcode = '22023';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'You do not have permission to manage nation discovery for this world.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  delete from public.nation_discoveries
  where nation_a_id = least(p_a, p_b)
    and nation_b_id = greatest(p_a, p_b);

  delete from public.nation_relationships
  where (from_nation_id = p_a and to_nation_id = p_b)
     or (from_nation_id = p_b and to_nation_id = p_a);

  update public.nation_treaties
     set status = 'broken'
   where status in ('proposed', 'active')
     and (
       (proposer_nation_id = p_a and responder_nation_id = p_b)
       or (proposer_nation_id = p_b and responder_nation_id = p_a)
     );
end;
$$;

revoke all on function public.set_nations_unmet (uuid, uuid)
from
  public;

grant
execute on function public.set_nations_unmet (uuid, uuid) to authenticated;
