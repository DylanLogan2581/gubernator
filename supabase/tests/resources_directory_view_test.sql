-- pgTAP tests for public.resources_directory_view (#1242).
-- Run with: npx supabase test db
--
-- The view is security_invoker, so row/column visibility is inherited
-- straight from resources_select_world_access (20260529000000) -- this file
-- only proves that inheritance holds and that the flattened category_name
-- column resolves correctly, including for uncategorized (null category_id)
-- resources via the left join. Full visibility-matrix coverage already
-- lives in resources_rls_test.sql.
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'directory-res-admin@example.com',
    'x',
    now(),
    '{"username":"directory_res_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'directory-res-outsider@example.com',
    'x',
    now(),
    '{"username":"directory_res_outsider"}'::jsonb,
    now(),
    now()
  );

-- Inserting the world fires the resources seed trigger (Food, Fresh Water).
insert into
  public.worlds (id, name, status)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'Res Directory World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001'
  );

insert into
  public.resource_categories (id, world_id, name, color)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Metals',
    '#ff0000'
  );

insert into
  public.resources (id, world_id, name, slug, category_id)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Iron Ore',
    'iron-ore',
    'f3000000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- OUTSIDER: no world access, sees nothing
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.resources_directory_view
      where
        world_id = 'f2000000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read the resources directory view'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: sees every resource row, with category flattened
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.resources_directory_view
      where
        world_id = 'f2000000-0000-0000-0000-000000000001'
    ),
    3,
    'world admin can read every resource row (including seeded system resources) in the directory view'
  );

select
  is (
    (
      select
        category_name
      from
        public.resources_directory_view
      where
        id = 'f4000000-0000-0000-0000-000000000001'
    ),
    'Metals',
    'directory view resolves category_name for a categorized resource'
  );

select
  is (
    (
      select
        category_name
      from
        public.resources_directory_view
      where
        world_id = 'f2000000-0000-0000-0000-000000000001'
        and slug = 'food'
    ),
    null,
    'directory view leaves category_name null for an uncategorized resource (left join)'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.resources_directory_view
      where
        world_id = 'f2000000-0000-0000-0000-000000000001'
        and category_id is null
    ),
    2,
    'uncategorized resources still appear in the directory view'
  );

reset role;

select
  *
from
  finish ();

rollback;
