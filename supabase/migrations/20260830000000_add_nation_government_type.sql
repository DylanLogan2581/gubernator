-- Migration: add_nation_government_type
-- Adds government_type to nations, the axis that will drive readiness rules,
-- succession, and offices in later Epic 11 issues. Behavior rules themselves
-- live in a separate shared government-rules module (separate issue).
-- ---------------------------------------------------------------------------
-- 1. Column
-- ---------------------------------------------------------------------------
alter table public.nations
add column government_type text not null default 'monarchy' check (
  government_type in (
    'monarchy',
    'republic',
    'theocracy',
    'tribal_council',
    'confederation',
    'despotism'
  )
);

-- ---------------------------------------------------------------------------
-- 2. Column grants: government_type joins the existing user-editable column
-- set on public.nations (name, description, is_hidden). The nations UPDATE
-- policy (nations_update_world_admin) already restricts writes to world
-- admins/super admins only, and nation managers hold no direct UPDATE grant
-- on this table at all, so this column is admin-only by the same RLS that
-- already governs name/description/is_hidden — no separate RPC is needed.
-- ---------------------------------------------------------------------------
revoke insert,
update on public.nations
from
  authenticated;

grant insert (
  id,
  world_id,
  name,
  description,
  is_hidden,
  government_type
) on public.nations to authenticated;

grant
update (name, description, is_hidden, government_type) on public.nations to authenticated;
