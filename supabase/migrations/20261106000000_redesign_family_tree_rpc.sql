-- Migration: redesign_family_tree_rpc
-- Redefines get_citizen_family_tree (issue #1184) to support a connector-drawn
-- tree chart on the client:
--   * Both parent slots of every node are now returned (parent_a_citizen_id,
--     parent_b_citizen_id) so the client can draw a "second parent" edge to
--     any co-parent that is already present elsewhere in the tree (e.g. a
--     grandchild's other parent being the center citizen's partner), on top
--     of the existing node_path/parent_path structural edge.
--   * When an ancestor's parent slots are BOTH empty, the walk now emits a
--     single collapsed 'AB' unknown terminator instead of one per slot --
--     previously a citizen with 2 known parents but fully-unknown
--     grandparents rendered 4 "Unknown" cards at that generation instead of 2.
--   * Partners are no longer filtered to status = 'active'. All partnerships
--     (active, dissolved, widowed) are returned, with the new
--     partnership_status column so the client can render former/widowed
--     partners with a distinguishing treatment while still connecting shared
--     children to both.
--
-- The return signature changed (three new columns), so the function is
-- dropped and recreated rather than replaced in place.
-- ---------------------------------------------------------------------------
drop function if exists public.get_citizen_family_tree (uuid);

create function public.get_citizen_family_tree (p_citizen_id uuid) returns table (
  node_path text,
  parent_path text,
  citizen_id uuid,
  name text,
  status text,
  direction text,
  generation integer,
  parent_a_citizen_id uuid,
  parent_b_citizen_id uuid,
  partnership_status text
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
        select
          raw_slot.label,
          raw_slot.parent_id
        from (
          values
            ('A', aw.parent_a_citizen_id),
            ('B', aw.parent_b_citizen_id)
        ) as raw_slot (label, parent_id)
        where
          aw.parent_a_citizen_id is not null
          or aw.parent_b_citizen_id is not null
        union all
        select
          'AB',
          null::uuid
        where
          aw.parent_a_citizen_id is null
          and aw.parent_b_citizen_id is null
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
      0 as generation,
      r.parent_a_citizen_id,
      r.parent_b_citizen_id
    from root_node r
    union all
    select
      dw.node_path || '.' || child.id::text,
      dw.node_path,
      child.id,
      child.name,
      child.status,
      dw.generation + 1,
      child.parent_a_citizen_id,
      child.parent_b_citizen_id
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
    generation,
    parent_a_citizen_id,
    parent_b_citizen_id,
    null::text as partnership_status
  from ancestor_walk
  union all
  select
    node_path,
    parent_path,
    citizen_id,
    name,
    status,
    'descendant' as direction,
    generation,
    parent_a_citizen_id,
    parent_b_citizen_id,
    null::text as partnership_status
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
    0 as generation,
    null::uuid as parent_a_citizen_id,
    null::uuid as parent_b_citizen_id,
    p.status as partnership_status
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
