-- ===========================================================================
-- large_world.sql — large-scale fixture world for performance benchmarking.
--
-- Target: 50 settlements · 10 000 citizens · full job assignments ·
--         active trade routes · sustained events.
--
-- Runtime-only tooling. Never included in seed.sql or shipped data.
-- Re-runnable: deletes any prior large-world build before rebuilding.
--
-- Prerequisites: a running local stack (npx supabase start) whose seeded auth
-- users already exist (npx supabase db reset once, OR a prior db reset with
-- seed.sql applied).
--
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     --single-transaction -v ON_ERROR_STOP=1 -f supabase/seed_tools/large_world.sql
--
-- UUID ranges (all share prefix 00000000-0000-0000-0002-):
--   000000000001          world
--   000000000100          nameset (single shared nameset)
--   000000000201–205      nations (5)
--   000000000301–350      settlements (50, 10 per nation)
--   000000000401–402      job definitions (field_hand, water_bearer)
--   000000000501          extra resource (grain; food+water auto-seeded)
--   000000001001–011000   citizens (10 000)
--   000000020001–020050   trade routes (up to 50)
-- ===========================================================================
set session_replication_role = default;

-- Tear down any prior large-world build.
delete from public.worlds where id = '00000000-0000-0000-0002-000000000001';

-- ---------------------------------------------------------------------------
-- All data is authored in a single DO block to allow cross-reference via
-- variables and to keep the generate_series inserts type-safe.
-- ---------------------------------------------------------------------------
do $$
declare
  -- ---------------------------------------------------------------------------
  -- Fixed UUIDs
  -- ---------------------------------------------------------------------------
  v_world     constant uuid := '00000000-0000-0000-0002-000000000001';
  v_nameset   constant uuid := '00000000-0000-0000-0002-000000000100';

  -- Jobs
  v_job_field_hand   constant uuid := '00000000-0000-0000-0002-000000000401';
  v_job_water_bearer constant uuid := '00000000-0000-0000-0002-000000000402';

  -- Extra resource (food + fresh-water auto-seeded by trigger)
  v_res_grain constant uuid := '00000000-0000-0000-0002-000000000501';

  -- Resolved at runtime
  v_res_food  uuid;
  v_res_water uuid;

  -- The first citizen (used as proposed_by / approved_by for trade routes)
  v_first_citizen constant uuid := '00000000-0000-0000-0002-000000001001';

  -- ---------------------------------------------------------------------------
  -- Generation constants
  -- ---------------------------------------------------------------------------
  N_NATIONS     constant int := 5;
  N_SETTLEMENTS constant int := 50;   -- 10 per nation
  N_CITIZENS    constant int := 10000; -- 200 per settlement
  N_EVENTS      constant int := 20;    -- sustained production_multiplier events
  N_ROUTES      constant int := 20;    -- trade routes between pairs of settlements

  -- ---------------------------------------------------------------------------
  -- Name pools (minimal; deterministic enough for perf fixtures)
  -- ---------------------------------------------------------------------------
  v_given_names constant text[] := array[
    'Aldous','Bryn','Cwen','Edric','Fern','Godwin','Hilda','Ivar',
    'Jorin','Kara','Leif','Mira','Niall','Orla','Pell','Riona',
    'Sven','Tilda','Unn','Vala','Wulf','Xana','Yrsa','Zara'
  ];
  v_surnames constant text[] := array[
    'Ashford','Barley','Copple','Durn','Elder','Fenwick','Green',
    'Harrow','Larks','Oxley','Thatch','Under','Weaver','Marrow',
    'Quill','Hollow','Bramble','Stock','Hayward','Penn'
  ];
  n_given int;
  n_surn  int;

  v_n int;
  v_s int;
  v_e int;
  v_r int;
begin
  n_given := array_length(v_given_names, 1);
  n_surn  := array_length(v_surnames,    1);

  -- -------------------------------------------------------------------------
  -- 1. World
  -- -------------------------------------------------------------------------
  insert into public.worlds (
    id, name, current_turn_number, visibility, status,
    calendar_config_json,
    partnership_seek_chance, fertility_chance,
    minimum_partnership_age_turns, maximum_fertility_age_turns,
    mourning_period_turns,
    npc_flavor_config_json
  ) values (
    v_world,
    'Benchmark World (large)',
    0,
    'private',
    'active',
    public.default_calendar_config(),
    0.20,
    0.06,
    16,
    45,
    3,
    '{
      "traits":["earnest","wry","patient","stoic","shrewd","blunt","watchful","scrappy","weary","fervent"],
      "contradictions":["loves their rival","holds a vow they cannot recall"],
      "goals":["a seat on the council","to restore the family name","to outlive every captain"],
      "flaws":["pride","envy","miserliness at home"]
    }'::jsonb
  );

  -- -------------------------------------------------------------------------
  -- 2. Nameset
  -- -------------------------------------------------------------------------
  insert into public.namesets (id, world_id, name, config_json, is_default)
  values (
    v_nameset,
    v_world,
    'Benchmark Names',
    jsonb_build_object(
      'male_given_names',   to_jsonb(v_given_names),
      'female_given_names', to_jsonb(v_given_names),
      'surnames',           to_jsonb(v_surnames),
      'convention',         'family-name'
    ),
    true
  );

  -- -------------------------------------------------------------------------
  -- 3. Nations (5)
  -- -------------------------------------------------------------------------
  for v_n in 1..N_NATIONS loop
    insert into public.nations (id, world_id, name, is_hidden, nameset_id)
    values (
      ('00000000-0000-0000-0002-' || lpad((200 + v_n)::text, 12, '0'))::uuid,
      v_world,
      'Nation ' || v_n,
      false,
      v_nameset
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 4. Settlements (50 — 10 per nation)
  --    The seed_settlement_stockpiles_on_settlement_insert trigger auto-creates
  --    stockpiles for all world resources that exist at insert time.
  -- -------------------------------------------------------------------------
  for v_s in 1..N_SETTLEMENTS loop
    insert into public.settlements (id, nation_id, name, auto_ready_enabled, is_ready_current_turn, nameset_id)
    values (
      ('00000000-0000-0000-0002-' || lpad((300 + v_s)::text, 12, '0'))::uuid,
      -- nation cycles 1..5 (10 settlements per nation)
      ('00000000-0000-0000-0002-' || lpad((200 + ((v_s - 1) / 10) + 1)::text, 12, '0'))::uuid,
      'Settlement ' || v_s,
      false,
      false,
      v_nameset
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 5. Extra resource: grain
  --    System resources (food, fresh-water) were auto-seeded by the world
  --    insert trigger.  Grain is added manually for trade route variety.
  -- -------------------------------------------------------------------------
  insert into public.resources (id, world_id, name, slug, base_stockpile_cap)
  values (v_res_grain, v_world, 'Grain', 'grain', 1000);

  -- Seed stockpiles for grain in all settlements (trigger doesn't backfill).
  insert into public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
  select
    ('00000000-0000-0000-0002-' || lpad((300 + s)::text, 12, '0'))::uuid,
    v_res_grain,
    500
  from generate_series(1, N_SETTLEMENTS) as gs(s)
  on conflict (settlement_id, resource_id) do nothing;

  -- Resolve system resource IDs.
  select id into v_res_food  from public.resources where world_id = v_world and slug = 'food';
  select id into v_res_water from public.resources where world_id = v_world and slug = 'fresh-water';

  -- -------------------------------------------------------------------------
  -- 6. Job definitions (2)
  -- -------------------------------------------------------------------------
  insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, inputs_json, outputs_json)
  values
    (v_job_field_hand,   v_world, 'Field Hand',   'field-hand',   'standard', 200,
     '[]'::jsonb,
     jsonb_build_array(jsonb_build_object('resource_id', v_res_food::text, 'amount_per_worker', 4))),
    (v_job_water_bearer, v_world, 'Water Bearer', 'water-bearer', 'standard', 200,
     '[]'::jsonb,
     jsonb_build_array(jsonb_build_object('resource_id', v_res_water::text, 'amount_per_worker', 4)));

  -- -------------------------------------------------------------------------
  -- 7. Citizens (10 000) — 200 per settlement, distributed round-robin.
  --    UUIDs: 000000001001 .. 000000011000
  --    Minimal NPC rows; name pool cycles deterministically.
  -- -------------------------------------------------------------------------
  insert into public.citizens (
    id, world_id, settlement_id, citizen_type,
    given_name, surname, sex, status, born_on_turn_number
  )
  select
    ('00000000-0000-0000-0002-' || lpad((1000 + gs.n)::text, 12, '0'))::uuid,
    v_world,
    -- cycle through settlements 1..50
    ('00000000-0000-0000-0002-' || lpad((300 + ((gs.n - 1) % N_SETTLEMENTS) + 1)::text, 12, '0'))::uuid,
    'npc',
    v_given_names[1 + ((gs.n - 1) % n_given)],
    v_surnames[1 + ((gs.n - 1) % n_surn)],
    case when gs.n % 2 = 0 then 'male' else 'female' end,
    'alive',
    -(gs.n % 60)
  from generate_series(1, N_CITIZENS) as gs(n);

  -- -------------------------------------------------------------------------
  -- 8. Citizen assignments — all citizens assigned to field_hand (standard_job)
  -- -------------------------------------------------------------------------
  insert into public.citizen_assignments (
    citizen_id, assignment_type, job_id, assigned_on_turn_number
  )
  select
    ('00000000-0000-0000-0002-' || lpad((1000 + gs.n)::text, 12, '0'))::uuid,
    'standard_job',
    v_job_field_hand,
    0
  from generate_series(1, N_CITIZENS) as gs(n);

  -- -------------------------------------------------------------------------
  -- 9. Trade routes (20) — food flowing between adjacent settlement pairs.
  --    Pairs: settlement s sends food to settlement s+1 (wrapping at 50).
  --    proposed_by / approved_by = first citizen.
  -- -------------------------------------------------------------------------
  for v_r in 1..N_ROUTES loop
    insert into public.trade_routes (
      id,
      origin_settlement_id,
      destination_settlement_id,
      status,
      proposed_by_citizen_id,
      origin_approval_status,
      destination_approval_status,
      origin_approved_by_citizen_id,
      destination_approved_by_citizen_id
    ) values (
      ('00000000-0000-0000-0002-' || lpad((20000 + v_r)::text, 12, '0'))::uuid,
      ('00000000-0000-0000-0002-' || lpad((300 + v_r)::text, 12, '0'))::uuid,
      ('00000000-0000-0000-0002-' || lpad((300 + (v_r % N_SETTLEMENTS) + 1)::text, 12, '0'))::uuid,
      'active',
      v_first_citizen,
      'approved',
      'approved',
      v_first_citizen,
      v_first_citizen
    );

    -- One leg: origin sends food, destination receives.
    insert into public.trade_route_legs (trade_route_id, direction, resource_id, quantity_per_transition)
    values
      (('00000000-0000-0000-0002-' || lpad((20000 + v_r)::text, 12, '0'))::uuid, 'send',    v_res_food, 20),
      (('00000000-0000-0000-0002-' || lpad((20000 + v_r)::text, 12, '0'))::uuid, 'receive', v_res_grain, 10);
  end loop;

  -- -------------------------------------------------------------------------
  -- 10. Sustained events (20) at world scope — production_multiplier.
  --     These are active, multi-transition events that survive multiple turns.
  --     event_effects rows are inserted separately below.
  -- -------------------------------------------------------------------------
  insert into public.events (
    id,
    world_id,
    name,
    description,
    status,
    effect_type,
    activate_on_transition_after_turn_number,
    duration_type,
    duration_transitions,
    remaining_transitions,
    scope_type,
    effect_payload_jsonb
  )
  select
    ('00000000-0000-0000-0002-' || lpad((30000 + gs.n)::text, 12, '0'))::uuid,
    v_world,
    'Harvest Surplus ' || gs.n,
    'A sustained production bonus event for benchmarking.',
    'active',
    null,   -- legacy effect_type null; effects are in event_effects
    0,
    'sustained',
    10,
    10,
    'world',
    '{}'::jsonb
  from generate_series(1, N_EVENTS) as gs(n);

  -- event_effects: one production_multiplier per event
  insert into public.event_effects (
    event_id,
    effect_type,
    multiplier_value,
    is_percent
  )
  select
    ('00000000-0000-0000-0002-' || lpad((30000 + gs.n)::text, 12, '0'))::uuid,
    'production_multiplier',
    1.10,
    false
  from generate_series(1, N_EVENTS) as gs(n);

end$$;

-- ---------------------------------------------------------------------------
-- Summary counts (printed when run interactively).
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.settlements s join public.nations n on n.id = s.nation_id where n.world_id = '00000000-0000-0000-0002-000000000001')::int as settlements,
  (select count(*) from public.citizens   where world_id = '00000000-0000-0000-0002-000000000001')::int as citizens,
  (select count(*) from public.citizen_assignments ca join public.citizens c on c.id = ca.citizen_id where c.world_id = '00000000-0000-0000-0002-000000000001')::int as assignments,
  (select count(*) from public.trade_routes tr join public.settlements s on s.id = tr.origin_settlement_id join public.nations n on n.id = s.nation_id where n.world_id = '00000000-0000-0000-0002-000000000001')::int as trade_routes,
  (select count(*) from public.events where world_id = '00000000-0000-0000-0002-000000000001')::int as events,
  (select count(*) from public.event_effects ee join public.events ev on ev.id = ee.event_id where ev.world_id = '00000000-0000-0000-0002-000000000001')::int as event_effects;
