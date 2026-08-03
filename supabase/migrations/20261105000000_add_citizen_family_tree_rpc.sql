-- Migration: add_citizen_family_tree_rpc
-- Adds get_citizen_family_tree, a single RPC that returns a pruned family
-- tree for a citizen: up to 3 generations of ancestors, up to 3 generations
-- of descendants, and the citizen's current active partner(s).
--
-- Unknown-parent rule: when a parent slot is empty, the tree emits a single
-- placeholder row (citizen_id null, direction 'unknown') and does not
-- recurse past it. Descendants never get an "unknown child" placeholder --
-- not knowing whether a citizen has children is not the same as a recorded
-- missing parent, so the walk simply stops when no children are found.
--
-- Visibility: this function is intentionally NOT security definer. It reads
-- public.citizens/public.partnerships as the calling user, so the existing
-- citizens_select_visible / partnerships_select_visible RLS policies apply
-- row-by-row exactly as they would for any direct query. A parent/child that
-- exists but is not visible to the caller (e.g. an NPC hidden from a
-- non-admin player) simply fails to join and collapses into the same
-- 'unknown' placeholder as a genuinely unrecorded parent -- this is
-- deliberately conservative: no row the caller cannot already see is ever
-- exposed through this RPC.
-- ---------------------------------------------------------------------------
create or replace function public.get_citizen_family_tree (p_citizen_id uuid) returns table (
  node_path text,
  parent_path text,
  citizen_id uuid,
  name text,
  status text,
  direction text,
  generation integer
) language sql stable
set
  search_path = '' as $$
  with recursive root_node as (
    select
      c.id as citizen_id,
      c.name,
      c.status,
      c.parent_a_citizen_id,
      c.parent_b_citizen_id
    from public.citizens c
    where c.id = p_citizen_id
  ),
  ancestor_walk as (
    select
      'root'::text as node_path,
      null::text as parent_path,
      r.citizen_id,
      r.name,
      r.status,
      r.parent_a_citizen_id,
      r.parent_b_citizen_id,
      0 as generation
    from root_node r
    union all
    select
      aw.node_path || '.' || slot.label,
      aw.node_path,
      slot.parent_id,
      pc.name,
      pc.status,
      pc.parent_a_citizen_id,
      pc.parent_b_citizen_id,
      aw.generation - 1
    from ancestor_walk aw
      cross join lateral (
        values
          ('A', aw.parent_a_citizen_id),
          ('B', aw.parent_b_citizen_id)
      ) as slot (label, parent_id)
      left join public.citizens pc on pc.id = slot.parent_id
    where
      aw.citizen_id is not null
      and aw.generation > -3
  ),
  descendant_walk as (
    select
      'root'::text as node_path,
      null::text as parent_path,
      r.citizen_id,
      r.name,
      r.status,
      0 as generation
    from root_node r
    union all
    select
      dw.node_path || '.' || child.id::text,
      dw.node_path,
      child.id,
      child.name,
      child.status,
      dw.generation + 1
    from descendant_walk dw
      inner join public.citizens child on child.parent_a_citizen_id = dw.citizen_id
      or child.parent_b_citizen_id = dw.citizen_id
    where
      dw.citizen_id is not null
      and dw.generation < 3
  )
  select
    node_path,
    parent_path,
    citizen_id,
    name,
    status,
    case
      when node_path = 'root' then 'self'
      when citizen_id is null then 'unknown'
      else 'ancestor'
    end as direction,
    generation
  from ancestor_walk
  union all
  select
    node_path,
    parent_path,
    citizen_id,
    name,
    status,
    'descendant' as direction,
    generation
  from descendant_walk
  where
    node_path <> 'root'
  union all
  select
    'partner:' || partner.id::text as node_path,
    'root' as parent_path,
    partner.id as citizen_id,
    partner.name,
    partner.status,
    'partner' as direction,
    0 as generation
  from public.partnerships p
    inner join public.citizens partner on partner.id = case
      when p.citizen_a_id = p_citizen_id then p.citizen_b_id
      else p.citizen_a_id
    end
  where
    (
      p.citizen_a_id = p_citizen_id
      or p.citizen_b_id = p_citizen_id
    )
    and p.status = 'active'
    and exists (
      select 1
      from root_node
    );
$$;

revoke all on function public.get_citizen_family_tree (uuid)
from
  public;

grant
execute on function public.get_citizen_family_tree (uuid) to authenticated;
