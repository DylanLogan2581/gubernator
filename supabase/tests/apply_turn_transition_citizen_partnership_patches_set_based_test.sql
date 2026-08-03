-- pgTAP tests for issue #1271: set-based citizen/partnership patch write path.
--
-- Verifies that internal_apply_turn_transition_citizen_partnership_patches
-- produces the same results on a LARGE multi-settlement payload as the old
-- row-by-row loops did, and that the non-birth loops no longer scale their
-- statement count with the element count (structural assertion on the function
-- definition). Births intentionally stay row-by-row (create_citizen_internal
-- generates the citizen id and resolves heredity/naming per birth) and are
-- covered by apply_turn_transition_citizen_partnership_patches_test.sql.
--
-- UUID prefix map (all b8-prefixed ranges, unique to this file):
--   b8100000 = users        b8200000 = worlds
--   b8300000 = nations      b8400000 = settlements
--   b8500000 = citizens     b8600000 = partnerships
--   b8700000 = job_definitions   b8800000 = deposit_types
--   b8900000 = deposit_instances b8a00000 = turn_transitions
--
-- Citizen id ranges within the payload:
--   1-20  bornOnTurnBackfill (1-10 also die; 20 appears twice: last wins)
--   21-40 assignmentClears + 10 newly formed partnerships
--   41-60 10 pre-existing active partnerships, all ended this turn
begin;

select
  plan (9);

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
    'b8100000-0000-0000-0000-000000000001',
    'attcp-setbased-superadmin@example.com',
    'x',
    now(),
    '{"username":"attcp_setbased_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'b8100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'b8200000-0000-0000-0000-000000000001',
    'ATTCP Set-Based World',
    5,
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'b8300000-0000-0000-0000-000000000001',
    'b8200000-0000-0000-0000-000000000001',
    'ATTCP Set-Based Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'b8400000-0000-0000-0000-000000000001',
    'b8300000-0000-0000-0000-000000000001',
    'ATTCP Set-Based Settlement 1'
  ),
  (
    'b8400000-0000-0000-0000-000000000002',
    'b8300000-0000-0000-0000-000000000001',
    'ATTCP Set-Based Settlement 2'
  ),
  (
    'b8400000-0000-0000-0000-000000000003',
    'b8300000-0000-0000-0000-000000000001',
    'ATTCP Set-Based Settlement 3'
  );

-- 60 NPCs spread round-robin across the three settlements.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    born_on_turn_number
  )
select
  (
    'b8500000-0000-0000-0000-' || lpad(i::text, 12, '0')
  )::uuid,
  'b8200000-0000-0000-0000-000000000001',
  (
    'b8400000-0000-0000-0000-' || lpad((1 + (i % 3))::text, 12, '0')
  )::uuid,
  'npc',
  'ATTCP SB NPC ' || i,
  'alive',
  1
from
  generate_series(1, 60) as i;

-- Ten pre-existing active partnerships between citizens 41-60, half of them
-- stored with the payload's (a, b) column order reversed to exercise the
-- either-column-order match in the set-based update.
insert into
  public.partnerships (
    id,
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number
  )
select
  (
    'b8600000-0000-0000-0000-' || lpad(i::text, 12, '0')
  )::uuid,
  case
    when i % 2 = 0 then (
      'b8500000-0000-0000-0000-' || lpad((40 + i)::text, 12, '0')
    )::uuid
    else (
      'b8500000-0000-0000-0000-' || lpad((50 + i)::text, 12, '0')
    )::uuid
  end,
  case
    when i % 2 = 0 then (
      'b8500000-0000-0000-0000-' || lpad((50 + i)::text, 12, '0')
    )::uuid
    else (
      'b8500000-0000-0000-0000-' || lpad((40 + i)::text, 12, '0')
    )::uuid
  end,
  'active',
  2
from
  generate_series(1, 10) as i;

-- Assignment chain so citizens 21-40 can hold a clearable 'deposit' assignment.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'b8700000-0000-0000-0000-000000000001',
    'b8200000-0000-0000-0000-000000000001',
    'ATTCP SB Mining',
    'attcp-sb-mining',
    'deposit'
  );

insert into
  public.deposit_types (id, world_id, name, slug)
values
  (
    'b8800000-0000-0000-0000-000000000001',
    'b8200000-0000-0000-0000-000000000001',
    'ATTCP SB Iron Vein',
    'attcp-sb-iron-vein'
  );

insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    'b8900000-0000-0000-0000-000000000001',
    'b8400000-0000-0000-0000-000000000001',
    'b8800000-0000-0000-0000-000000000001',
    'ATTCP SB Vein',
    'active'
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    deposit_instance_id,
    assigned_on_turn_number
  )
select
  (
    'b8500000-0000-0000-0000-' || lpad(i::text, 12, '0')
  )::uuid,
  'deposit',
  'b8900000-0000-0000-0000-000000000001',
  4
from
  generate_series(21, 40) as i;

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status
  )
values
  (
    'b8a00000-0000-0000-0000-000000000001',
    'b8200000-0000-0000-0000-000000000001',
    5,
    6,
    'b8100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- Apply the large payload once; assertions read the returned patch counts and
-- the resulting rows.
-- ===========================================================================
set
  local role service_role;

create temporary table attcp_sb_result as
select
  public.apply_turn_transition (
    'b8200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'bornOnTurnBackfill',
      (
        select
          jsonb_agg(
            jsonb_build_object(
              'citizenId',
              (
                'b8500000-0000-0000-0000-' || lpad(i::text, 12, '0')
              )::uuid,
              'bornOnTurnNumber',
              2
            )
            order by
              i
          )
        from
          generate_series(1, 20) as i
      ) || jsonb_build_array(
        jsonb_build_object(
          'citizenId',
          'b8500000-0000-0000-0000-000000000020',
          'bornOnTurnNumber',
          7
        )
      ),
      'citizenDeaths',
      (
        select
          jsonb_agg(
            jsonb_build_object(
              'citizenId',
              (
                'b8500000-0000-0000-0000-' || lpad(i::text, 12, '0')
              )::uuid,
              'deathCauseCategory',
              'starvation',
              'deathCause',
              'no food'
            )
            order by
              i
          )
        from
          generate_series(1, 10) as i
      ) || jsonb_build_array(
        jsonb_build_object(
          'citizenId',
          'b8500000-0000-0000-0000-000000000010',
          'deathCauseCategory',
          'homeless',
          'deathCause',
          'exposure'
        )
      ),
      'partnershipChanges',
      (
        select
          jsonb_agg(
            jsonb_build_object(
              'citizenAId',
              (
                'b8500000-0000-0000-0000-' || lpad((20 + i)::text, 12, '0')
              )::uuid,
              'citizenBId',
              (
                'b8500000-0000-0000-0000-' || lpad((30 + i)::text, 12, '0')
              )::uuid,
              'toStatus',
              'active',
              'formedOnTurnNumber',
              6,
              'endedOnTurnNumber',
              null
            )
            order by
              i
          )
        from
          generate_series(1, 10) as i
      ) || (
        select
          jsonb_agg(
            jsonb_build_object(
              'citizenAId',
              (
                'b8500000-0000-0000-0000-' || lpad((40 + i)::text, 12, '0')
              )::uuid,
              'citizenBId',
              (
                'b8500000-0000-0000-0000-' || lpad((50 + i)::text, 12, '0')
              )::uuid,
              'toStatus',
              'widowed',
              'formedOnTurnNumber',
              null,
              'endedOnTurnNumber',
              6
            )
            order by
              i
          )
        from
          generate_series(1, 10) as i
      ),
      'assignmentClears',
      (
        select
          jsonb_agg(
            jsonb_build_object(
              'citizenId',
              (
                'b8500000-0000-0000-0000-' || lpad(i::text, 12, '0')
              )::uuid
            )
            order by
              i
          )
        from
          generate_series(21, 40) as i
      )
    ),
    'b8a00000-0000-0000-0000-000000000001'::uuid
  ) as result;

-- ===========================================================================
-- TEST 1: reported patch counts are payload element counts, as before
-- ===========================================================================
select
  results_eq (
    $$
    select
      (result -> 'patchCounts' ->> 'bornOnTurnBackfill')::integer,
      (result -> 'patchCounts' ->> 'citizenDeaths')::integer,
      (result -> 'patchCounts' ->> 'partnershipChanges')::integer,
      (result -> 'patchCounts' ->> 'assignmentClears')::integer
    from attcp_sb_result
  $$,
    $$ values (21, 11, 20, 20) $$,
    'large payload: patch counts equal payload element counts'
  );

-- ===========================================================================
-- TEST 2: every backfill element applied
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizens c
      where
        c.world_id = 'b8200000-0000-0000-0000-000000000001'
        and c.born_on_turn_number = 2
    ),
    19,
    'large payload: 19 backfilled citizens set to born_on_turn_number 2'
  );

-- ===========================================================================
-- TEST 3: duplicate backfill entries for one citizen resolve last-wins
-- ===========================================================================
select
  is (
    (
      select
        c.born_on_turn_number
      from
        public.citizens c
      where
        c.id = 'b8500000-0000-0000-0000-000000000020'
    ),
    7,
    'large payload: duplicate backfill entries resolve last-wins'
  );

-- ===========================================================================
-- TEST 4: every death applied, with the manager role cleared
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizens c
      where
        c.world_id = 'b8200000-0000-0000-0000-000000000001'
        and c.status = 'dead'
        and c.death_cause = 'no food'
        and c.role_type = 'none'
    ),
    9,
    'large payload: 9 citizens marked dead with cause and cleared role'
  );

-- ===========================================================================
-- TEST 5: duplicate death entries for one citizen resolve last-wins
-- ===========================================================================
select
  results_eq (
    $$
    select
      status,
      death_cause_category::text,
      death_cause
    from public.citizens
    where id = 'b8500000-0000-0000-0000-000000000010'
  $$,
    $$ values ('dead', 'homeless', 'exposure') $$,
    'large payload: duplicate death entries resolve last-wins'
  );

-- ===========================================================================
-- TEST 6: formations inserted set-wise
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.partnerships p
        inner join public.citizens c on c.id = p.citizen_a_id
      where
        c.world_id = 'b8200000-0000-0000-0000-000000000001'
        and p.status = 'active'
        and p.formed_on_turn_number = 6
    ),
    10,
    'large payload: 10 partnerships formed in one insert'
  );

-- ===========================================================================
-- TEST 7: terminal changes matched in either stored column order
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.partnerships p
      where
        p.id::text like 'b8600000-%'
        and p.status = 'widowed'
        and p.ended_on_turn_number = 6
    ),
    10,
    'large payload: 10 partnerships ended regardless of stored column order'
  );

-- ===========================================================================
-- TEST 8: assignment clears applied set-wise
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.deposit_instance_id = 'b8900000-0000-0000-0000-000000000001'
    ),
    0,
    'large payload: all cleared assignments deleted in one statement'
  );

reset role;

-- ===========================================================================
-- TEST 9: statement count no longer scales with element count — only the
-- births loop remains; every other payload array is applied set-wise.
-- ===========================================================================
select
  ok (
    pg_get_functiondef(
      'public.internal_apply_turn_transition_citizen_partnership_patches(uuid,uuid,jsonb)'::regprocedure
    ) like '%jsonb_to_recordset%'
    and (
      length(
        pg_get_functiondef(
          'public.internal_apply_turn_transition_citizen_partnership_patches(uuid,uuid,jsonb)'::regprocedure
        )
      ) - length(
        replace(
          pg_get_functiondef(
            'public.internal_apply_turn_transition_citizen_partnership_patches(uuid,uuid,jsonb)'::regprocedure
          ),
          'end loop',
          ''
        )
      )
    ) / length('end loop') = 1,
    'citizen/partnership write path keeps only the births loop'
  );

rollback;
