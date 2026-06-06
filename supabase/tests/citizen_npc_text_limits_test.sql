-- pgTAP tests for citizen NPC text column length constraints added in
-- 20260528000006_add_citizen_npc_text_length_checks.sql.
-- Run with: npx supabase test db
begin;

select
  plan (10);

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
    'f7000000-0000-0000-0000-000000000001',
    'citizen-text-limits@example.com',
    'x',
    now(),
    '{"username":"citizen_text_limits"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'f8000000-0000-0000-0000-000000000001',
    'Citizen Text Limits World',
    'private',
    'active'
  );

-- ---------------------------------------------------------------------------
-- personality_text (max 1000)
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    insert into public.citizens (world_id, citizen_type, name, personality_text)
    values (
      'f8000000-0000-0000-0000-000000000001',
      'npc',
      'Limit NPC',
      repeat('x', 1000)
    )
  $test$,
    'citizen personality_text at 1000 chars is accepted'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (world_id, citizen_type, name, personality_text)
    values (
      'f8000000-0000-0000-0000-000000000001',
      'npc',
      'Limit NPC',
      repeat('x', 1001)
    )
  $test$,
    '23514',
    null,
    'citizen personality_text over 1000 chars is rejected'
  );

-- ---------------------------------------------------------------------------
-- npc_trait_1 (max 200)
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    insert into public.citizens (world_id, citizen_type, name, npc_trait_1)
    values (
      'f8000000-0000-0000-0000-000000000001',
      'npc',
      'Limit NPC',
      repeat('x', 200)
    )
  $test$,
    'citizen npc_trait_1 at 200 chars is accepted'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (world_id, citizen_type, name, npc_trait_1)
    values (
      'f8000000-0000-0000-0000-000000000001',
      'npc',
      'Limit NPC',
      repeat('x', 201)
    )
  $test$,
    '23514',
    null,
    'citizen npc_trait_1 over 200 chars is rejected'
  );

-- ---------------------------------------------------------------------------
-- Remaining columns: one boundary check each
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $test$
    insert into public.citizens (world_id, citizen_type, name, skills_text)
    values (
      'f8000000-0000-0000-0000-000000000001',
      'npc',
      'Limit NPC',
      repeat('x', 1001)
    )
  $test$,
    '23514',
    null,
    'citizen skills_text over 1000 chars is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (world_id, citizen_type, name, npc_trait_2)
    values (
      'f8000000-0000-0000-0000-000000000001',
      'npc',
      'Limit NPC',
      repeat('x', 201)
    )
  $test$,
    '23514',
    null,
    'citizen npc_trait_2 over 200 chars is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (world_id, citizen_type, name, npc_secret_contradiction)
    values (
      'f8000000-0000-0000-0000-000000000001',
      'npc',
      'Limit NPC',
      repeat('x', 1001)
    )
  $test$,
    '23514',
    null,
    'citizen npc_secret_contradiction over 1000 chars is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (world_id, citizen_type, name, npc_goal)
    values (
      'f8000000-0000-0000-0000-000000000001',
      'npc',
      'Limit NPC',
      repeat('x', 1001)
    )
  $test$,
    '23514',
    null,
    'citizen npc_goal over 1000 chars is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (world_id, citizen_type, name, npc_flaw)
    values (
      'f8000000-0000-0000-0000-000000000001',
      'npc',
      'Limit NPC',
      repeat('x', 1001)
    )
  $test$,
    '23514',
    null,
    'citizen npc_flaw over 1000 chars is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.citizens (world_id, citizen_type, name, death_cause)
    values (
      'f8000000-0000-0000-0000-000000000001',
      'npc',
      'Limit NPC',
      repeat('x', 1001)
    )
  $test$,
    '23514',
    null,
    'citizen death_cause over 1000 chars is rejected'
  );

rollback;
