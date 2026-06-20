-- ===========================================================================
-- build_world.sql — turn-0 builder for the Aldermoor demo world. Step 1 of the
-- seed regeneration pipeline; normally invoked by supabase/seed_tools/regenerate.sh.
-- It loads as the postgres superuser (RLS bypassed; triggers ACTIVE) and wipes
-- any prior build of world 101 before authoring it fresh, e.g.:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     --single-transaction -v ON_ERROR_STOP=1 -f supabase/seed_tools/build_world.sql
-- The seeded auth users (superadmin@gubernator.local etc.) must already exist.
-- After this builds, regenerate.sh drives the simulation forward 32 turns and
-- dumps the full public state into supabase/seed.sql.
-- ===========================================================================

-- Re-runnable teardown: wipe any prior build of the world. TRUNCATE CASCADE
-- avoids the resource/job referential-integrity BEFORE DELETE triggers and
-- clears every world-scoped table while leaving auth + public.users intact.
set session_replication_role = default;
truncate table public.worlds cascade;

-- Name pools per culture (shared by namesets + NPC generation). Temp table so
-- it never lands in the dump.
create temp table tmp_pools (
  culture int primary key,
  male text[],
  female text[],
  surnames text[]
);

insert into tmp_pools values
  (1,
   array['Aldous','Bram','Cuthwin','Edric','Godwin','Harwin','Leofric','Osmund','Wulfric','Eadwin','Bertram','Aldhelm','Cedric','Dunstan','Garrick','Hollis','Merek','Oswin','Rowan','Selwyn','Tobin','Wystan','Alric','Doran'],
   array['Aedith','Bryn','Cwen','Edolie','Gytha','Hilda','Leofgyth','Mildreth','Wynflaed','Rowena','Alvina','Edith','Goda','Hartha','Linnet','Maerwynn','Odila','Saewara','Tilda','Wilda','Brielle','Elsbeth','Maud','Nesta'],
   array['Ashford','Barleywick','Coppleby','Durnmere','Elderbrook','Fenwick','Greenhollow','Harrowgate','Larkspur','Oxley','Thatcher','Underhill','Weaverson','Marrow','Quill','Hollow','Brambleton','Stockwell','Hayward','Pennington','Redfern','Whitlow','Crane','Bramble']),
  (2,
   array['Bjorn','Eirik','Gunnar','Halvard','Ivar','Leif','Sten','Torvald','Sigmund','Roald','Knut','Vidar','Arne','Erland','Frode','Hakon','Olav','Ragnar','Eskil','Ulf','Yngve','Brandt','Soren','Tarjei'],
   array['Astrid','Brynja','Frida','Gudrun','Helga','Ingrid','Liv','Ragnhild','Sigrun','Thora','Yrsa','Senna','Solveig','Hilde','Borghild','Dagny','Eira','Gunnhild','Inga','Kari','Maren','Runa','Silje','Tove'],
   array['Saltkeel','Stormborn','Tidewright','Frosthand','Gullsworn','Harbormann','Netherquay','Brinemoor','Coldwater','Fairwind','Saltmarsh','Driftwood','Seaholm','Wavecrest','Hookline','Anchorfast','Kelpvik','Sternvold','Bayard','Greysail','Marshfen','Quayle','Herring','Sandholm']),
  (3,
   array['Brennan','Cormac','Dougal','Eamon','Fergus','Galen','Lachlan','Murtagh','Niall','Ronan','Tavish','Aodhan','Callum','Declan','Ewan','Finlay','Gowan','Keir','Lorne','Padraig','Ruairi','Struan','Torin','Alasdair'],
   array['Aileen','Brigid','Caitrin','Deirdre','Eithne','Fionnula','Maeve','Nora','Riona','Saoirse','Una','Bryn','Caoimhe','Ailsa','Mairi','Orla','Sorcha','Tamsin','Greer','Iona','Kenna','Moira','Nessa','Rhona'],
   array['Carrick','Dunmore','Glenholm','Heatherlee','Killian','Macewan','Strathorn','Blackcairn','Roundstone','Mossbrae','Craigie','Lochmara','Bracken','Cairnduff','Drummond','Fennick','Glaisne','Kinnaird','Lennox','Muirhead','Rannoch','Tarbet','Whithorn','Braemar']);

-- ---------------------------------------------------------------------------
-- 1. World. npc_flavor_config_json uses an apostrophe-free pool (>=15 traits,
--    >=8 contradictions, >=10 goals, >=10 flaws). naming_config default 'pool'.
-- ---------------------------------------------------------------------------
insert into public.worlds (
  id, name, current_turn_number, visibility, status, calendar_config_json,
  partnership_seek_chance, fertility_chance, minimum_partnership_age_turns,
  maximum_fertility_age_turns, mourning_period_turns,
  npc_flavor_config_json
)
values (
  '00000000-0000-0000-0000-000000000101',
  'Aldermoor',
  0,
  'private',
  'active',
  public.default_calendar_config(),
  0.25,
  0.08,
  16,
  45,
  3,
  '{
    "traits": ["earnest","wry","patient","haunted","boisterous","stoic","tender","shrewd","blunt","watchful","scrappy","courtly","weary","fervent","soft-spoken"],
    "contradictions": ["mourns a friend they betrayed","loves their rival","shelters a soldier they once fought","keeps a portrait they never named","holds a vow they cannot recall","owes a debt to those they hunt","hides a wound that should have killed them","writes letters to a silent god"],
    "goals": ["a seat on the council","to restore the family name","to walk the south road once more","to read the unburned library","to outlive every captain","to apprentice a child of the lower ward","to see the long winter end","to die at home and not on the road","to repay the gold lender of Mistfall","to raise the standing stones again"],
    "flaws": ["pride","envy","an addiction to risk","a quiet drinking habit","an inability to forgive the dead","a temper that surfaces in writing","a need to be the cleverest voice","miserliness at home","reads every silence as betrayal","certainty they alone hold the line"]
  }'::jsonb
);

-- ---------------------------------------------------------------------------
-- 2. Namesets (one per culture). World default = Aldermoor Vale.
-- ---------------------------------------------------------------------------
insert into public.namesets (id, world_id, name, config_json, is_default)
select
  ('00000000-0000-0000-0000-00000000070' || p.culture)::uuid,
  '00000000-0000-0000-0000-000000000101',
  case p.culture when 1 then 'Aldermoor Vale' when 2 then 'Saltmarsh Coast' else 'Carrach Highland' end,
  jsonb_build_object(
    'male_given_names', to_jsonb(p.male),
    'female_given_names', to_jsonb(p.female),
    'surnames', to_jsonb(p.surnames),
    'convention', 'family-name'
  ),
  (p.culture = 1)
from tmp_pools p;

-- ---------------------------------------------------------------------------
-- 3. Nations (3), each wired to its culture nameset.
-- ---------------------------------------------------------------------------
insert into public.nations (id, world_id, name, description, is_hidden, nameset_id)
values
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    'Kingdom of Brammel',
    'Inland farming kingdom whose ledger-halls at Aldercross coordinate the grain rotation across the vale.',
    false,
    '00000000-0000-0000-0000-000000000701'
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000101',
    'Saltmarsh League of Caldhaven',
    'A league of coastal harbour-towns whose moots bargain over fishing rights, salt, and the long peace with Brammel.',
    false,
    '00000000-0000-0000-0000-000000000702'
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000101',
    'Highland Clans of Carrowmoor',
    'Highland clans of miners and herders whose old pacts with Brammel outlived their last reigning thane.',
    false,
    '00000000-0000-0000-0000-000000000703'
  );

-- ---------------------------------------------------------------------------
-- 4. Settlements (6). Readiness matrix: 301 manual-ready, 303 auto-ready,
--    rest not-ready.
-- ---------------------------------------------------------------------------
insert into public.settlements (
  id, nation_id, name, description, coord_x, coord_z,
  auto_ready_enabled, is_ready_current_turn, last_ready_at, ready_set_at
)
values
  ('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201','Aldercross','Walled market capital of Brammel where the readiness clerks mark each turn by hand.', 12.5000, -4.2500, false, true, '2026-05-03 12:00:00+00', '2026-05-03 12:00:00+00'),
  ('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000201','Wendlin','Riverside farming village whose granaries feed the lower vale.', 18.0000, 7.7500, false, false, null, null),
  ('00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000201','Bramhollow','Wooded holdfast whose council rolls readiness forward automatically each turn.', -3.1250, 14.5000, true, false, null, null),
  ('00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000202','Saltmere','Chief harbour of the Saltmarsh League; its quays handle the copper and salt trade.', -22.5000, -8.7500, false, false, null, null),
  ('00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000202','Cobbleford','Fenland fishing town raised on peat cuttings and cobbled causeways.', -18.7500, 4.2500, false, false, null, null),
  ('00000000-0000-0000-0000-000000000306','00000000-0000-0000-0000-000000000203','Carrick Hold','Highland mining hold of Carrowmoor, founded over a deep iron seam.', 5.7500, -19.2500, false, false, null, null);

-- ---------------------------------------------------------------------------
-- 5. Economy pack: resources, jobs (all 6 job_types + dedicated food/water
--    producers), deposit types, managed-population types, blueprints, tiers.
--    System resources Food + Fresh Water were auto-created by the world insert
--    trigger; resolved by slug for the job/tier references below.
-- ---------------------------------------------------------------------------
do $$
declare
  v_world constant uuid := '00000000-0000-0000-0000-000000000101';

  -- non-system resources (0004-1xx)
  v_res_grain         uuid := '00000000-0000-0000-0004-000000000101';
  v_res_salted_pork   uuid := '00000000-0000-0000-0004-000000000102';
  v_res_smoked_mutton uuid := '00000000-0000-0000-0004-000000000103';
  v_res_honey         uuid := '00000000-0000-0000-0004-000000000104';
  v_res_ale           uuid := '00000000-0000-0000-0004-000000000105';
  v_res_linen_cloth   uuid := '00000000-0000-0000-0004-000000000106';
  v_res_wool          uuid := '00000000-0000-0000-0004-000000000107';
  v_res_hardwood_logs uuid := '00000000-0000-0000-0004-000000000108';
  v_res_stone_block   uuid := '00000000-0000-0000-0004-000000000109';
  v_res_iron_ore      uuid := '00000000-0000-0000-0004-000000000110';
  v_res_copper_ingot  uuid := '00000000-0000-0000-0004-000000000111';
  v_res_peat          uuid := '00000000-0000-0000-0004-000000000112';
  v_res_sea_salt      uuid := '00000000-0000-0000-0004-000000000113';
  v_res_food          uuid;
  v_res_water         uuid;

  -- jobs (0005-1xx)
  v_job_field_hand     uuid := '00000000-0000-0000-0005-000000000101';
  v_job_water_bearer   uuid := '00000000-0000-0000-0005-000000000102';
  v_job_grain_farmer   uuid := '00000000-0000-0000-0005-000000000103';
  v_job_brewer         uuid := '00000000-0000-0000-0005-000000000104';
  v_job_cloth_weaver   uuid := '00000000-0000-0000-0005-000000000105';
  v_job_fisher         uuid := '00000000-0000-0000-0005-000000000106';
  v_job_stone_mason    uuid := '00000000-0000-0000-0005-000000000107';
  v_job_caravan_trader uuid := '00000000-0000-0000-0005-000000000108';
  v_job_iron_miner     uuid := '00000000-0000-0000-0005-000000000109';
  v_job_copper_miner   uuid := '00000000-0000-0000-0005-000000000110';
  v_job_stone_quarry   uuid := '00000000-0000-0000-0005-000000000111';
  v_job_lumberjack     uuid := '00000000-0000-0000-0005-000000000112';
  v_job_peat_cutter    uuid := '00000000-0000-0000-0005-000000000113';
  v_job_shepherd       uuid := '00000000-0000-0000-0005-000000000114';
  v_job_beekeeper      uuid := '00000000-0000-0000-0005-000000000115';
  v_job_swineherd      uuid := '00000000-0000-0000-0005-000000000116';
  v_job_mutton_butcher uuid := '00000000-0000-0000-0005-000000000117';
  v_job_honey_gatherer uuid := '00000000-0000-0000-0005-000000000118';
  v_job_pork_butcher   uuid := '00000000-0000-0000-0005-000000000119';

  -- deposit types (0008-1xx)
  v_dep_iron_vein      uuid := '00000000-0000-0000-0008-000000000101';
  v_dep_copper_vein    uuid := '00000000-0000-0000-0008-000000000102';
  v_dep_stone_quarry   uuid := '00000000-0000-0000-0008-000000000103';
  v_dep_hardwood_grove uuid := '00000000-0000-0000-0008-000000000104';
  v_dep_peat_bog       uuid := '00000000-0000-0000-0008-000000000105';

  -- managed pop types (0009-1xx)
  v_pop_sheep_herd uuid := '00000000-0000-0000-0009-000000000101';
  v_pop_bee_colony uuid := '00000000-0000-0000-0009-000000000102';
  v_pop_pig_herd   uuid := '00000000-0000-0000-0009-000000000103';

  -- blueprints (0006-1xx) + tiers (0007-..)
  v_bp_granary    uuid := '00000000-0000-0000-0006-000000000101';
  v_bp_cistern    uuid := '00000000-0000-0000-0006-000000000102';
  v_bp_storehouse uuid := '00000000-0000-0000-0006-000000000103';
  v_bp_workshop   uuid := '00000000-0000-0000-0006-000000000104';
  v_bp_longhouse  uuid := '00000000-0000-0000-0006-000000000105';
  v_bp_smithy     uuid := '00000000-0000-0000-0006-000000000106';
  v_tier_granary_1    uuid := '00000000-0000-0000-0007-000000001011';
  v_tier_cistern_1    uuid := '00000000-0000-0000-0007-000000001021';
  v_tier_storehouse_1 uuid := '00000000-0000-0000-0007-000000001031';
  v_tier_workshop_1   uuid := '00000000-0000-0000-0007-000000001041';
  v_tier_longhouse_1  uuid := '00000000-0000-0000-0007-000000001051';
  v_tier_smithy_1     uuid := '00000000-0000-0000-0007-000000001061';
  v_tier_smithy_2     uuid := '00000000-0000-0000-0007-000000001062';
begin
  select id into v_res_food  from public.resources where world_id = v_world and slug = 'food';
  select id into v_res_water from public.resources where world_id = v_world and slug = 'fresh-water';

  -- Resources -----------------------------------------------------------
  insert into public.resources (id, world_id, name, slug, base_stockpile_cap) values
    (v_res_grain,         v_world, 'Grain',         'grain',         2000),
    (v_res_salted_pork,   v_world, 'Cured Pork',    'salted-pork',    500),
    (v_res_smoked_mutton, v_world, 'Smoked Mutton', 'smoked-mutton',  500),
    (v_res_honey,         v_world, 'Honey',         'honey',          300),
    (v_res_ale,           v_world, 'Ale',           'ale',            400),
    (v_res_linen_cloth,   v_world, 'Linen Cloth',   'linen-cloth',    300),
    (v_res_wool,          v_world, 'Wool',          'wool',           500),
    (v_res_hardwood_logs, v_world, 'Hardwood Logs', 'hardwood-logs', 1000),
    (v_res_stone_block,   v_world, 'Stone Block',   'stone-block',   1200),
    (v_res_iron_ore,      v_world, 'Iron Ore',      'iron-ore',       800),
    (v_res_copper_ingot,  v_world, 'Copper Ingot',  'copper-ingot',   400),
    (v_res_peat,          v_world, 'Peat',          'peat',           600),
    (v_res_sea_salt,      v_world, 'Sea Salt',      'sea-salt',       400);

  -- Jobs: standard producers/consumers ---------------------------------
  insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity, inputs_json, outputs_json) values
    (v_job_field_hand, v_world, 'Field Hand', 'field-hand', 'standard', 30,
       '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_food::text, 'amount_per_worker', 4))),
    (v_job_water_bearer, v_world, 'Water Bearer', 'water-bearer', 'standard', 24,
       '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_water::text, 'amount_per_worker', 5))),
    (v_job_grain_farmer, v_world, 'Grain Farmer', 'grain-farmer', 'standard', 16,
       '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_worker', 3))),
    (v_job_brewer, v_world, 'Brewer', 'brewer', 'standard', 6,
       jsonb_build_array(
         jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_worker', 2),
         jsonb_build_object('resource_id', v_res_honey::text, 'amount_per_worker', 0.5)),
       jsonb_build_array(jsonb_build_object('resource_id', v_res_ale::text, 'amount_per_worker', 1))),
    (v_job_cloth_weaver, v_world, 'Cloth Weaver', 'cloth-weaver', 'standard', 8,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_wool::text, 'amount_per_worker', 2)),
       jsonb_build_array(jsonb_build_object('resource_id', v_res_linen_cloth::text, 'amount_per_worker', 1))),
    (v_job_fisher, v_world, 'Fisher', 'fisher', 'standard', 12,
       '[]'::jsonb,
       jsonb_build_array(
         jsonb_build_object('resource_id', v_res_food::text, 'amount_per_worker', 2),
         jsonb_build_object('resource_id', v_res_sea_salt::text, 'amount_per_worker', 1)));

  -- Construction + trader ----------------------------------------------
  insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity) values
    (v_job_stone_mason, v_world, 'Stone Mason', 'stone-mason', 'construction', 6);
  insert into public.job_definitions (id, world_id, name, slug, job_type, trader_capacity_per_worker) values
    (v_job_caravan_trader, v_world, 'Caravan Trader', 'caravan-trader', 'trader', 3);

  -- Deposit jobs (linked_deposit_type_id via DEFERRABLE FK) -------------
  insert into public.job_definitions (id, world_id, name, slug, job_type, linked_deposit_type_id) values
    (v_job_iron_miner,   v_world, 'Iron Miner',      'iron-miner',      'deposit', v_dep_iron_vein),
    (v_job_copper_miner, v_world, 'Copper Miner',    'copper-miner',    'deposit', v_dep_copper_vein),
    (v_job_stone_quarry, v_world, 'Stone Quarryman', 'stone-quarryman', 'deposit', v_dep_stone_quarry),
    (v_job_lumberjack,   v_world, 'Lumberjack',      'lumberjack',      'deposit', v_dep_hardwood_grove),
    (v_job_peat_cutter,  v_world, 'Peat Cutter',     'peat-cutter',     'deposit', v_dep_peat_bog);

  -- Husbandry + culling jobs -------------------------------------------
  insert into public.job_definitions (id, world_id, name, slug, job_type, linked_managed_population_type_id) values
    (v_job_shepherd,       v_world, 'Shepherd',       'shepherd',       'husbandry', v_pop_sheep_herd),
    (v_job_beekeeper,      v_world, 'Beekeeper',      'beekeeper',      'husbandry', v_pop_bee_colony),
    (v_job_swineherd,      v_world, 'Swineherd',      'swineherd',      'husbandry', v_pop_pig_herd),
    (v_job_mutton_butcher, v_world, 'Mutton Butcher', 'mutton-butcher', 'culling',   v_pop_sheep_herd),
    (v_job_honey_gatherer, v_world, 'Honey Gatherer', 'honey-gatherer', 'culling',   v_pop_bee_colony),
    (v_job_pork_butcher,   v_world, 'Pork Butcher',   'pork-butcher',   'culling',   v_pop_pig_herd);

  -- Deposit types ------------------------------------------------------
  insert into public.deposit_types (id, world_id, name, slug, job_id, output_units_per_worker, worker_inputs_json) values
    (v_dep_iron_vein,      v_world, 'Iron Vein',      'iron-vein',      v_job_iron_miner,   5,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_linen_cloth::text, 'amount_per_worker', 0.5))),
    (v_dep_copper_vein,    v_world, 'Copper Vein',    'copper-vein',    v_job_copper_miner, 4, '[]'::jsonb),
    (v_dep_stone_quarry,   v_world, 'Stone Quarry',   'stone-quarry',   v_job_stone_quarry, 8,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount_per_worker', 0.5))),
    (v_dep_hardwood_grove, v_world, 'Hardwood Grove', 'hardwood-grove', v_job_lumberjack,   6, '[]'::jsonb),
    (v_dep_peat_bog,       v_world, 'Peat Bog',       'peat-bog',       v_job_peat_cutter,  6, '[]'::jsonb);

  -- Managed population types -------------------------------------------
  insert into public.managed_population_types (
    id, world_id, name, slug, husbandry_job_id, culling_job_id,
    husbandry_workers_per_n_animals, growth_rate,
    maintenance_rules_json, culling_outputs_json, regular_outputs_json
  ) values
    (v_pop_sheep_herd, v_world, 'Sheep Herd', 'sheep-herd', v_job_shepherd, v_job_mutton_butcher,
       10, 0.10,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_n_animals', 0.5)),
       jsonb_build_array(jsonb_build_object('resource_id', v_res_smoked_mutton::text, 'amount_per_n_animals', 0.5)),
       jsonb_build_array(jsonb_build_object('resource_id', v_res_wool::text, 'amount_per_n_animals', 0.25))),
    (v_pop_bee_colony, v_world, 'Bee Colony', 'bee-colony', v_job_beekeeper, v_job_honey_gatherer,
       20, 0.05,
       '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_honey::text, 'amount_per_n_animals', 2)),
       '[]'::jsonb),
    (v_pop_pig_herd, v_world, 'Pig Herd', 'pig-herd', v_job_swineherd, v_job_pork_butcher,
       8, 0.15,
       jsonb_build_array(jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_n_animals', 1)),
       jsonb_build_array(jsonb_build_object('resource_id', v_res_salted_pork::text, 'amount_per_n_animals', 2)),
       '[]'::jsonb);

  -- Building blueprints ------------------------------------------------
  insert into public.building_blueprints (id, world_id, name, slug, description, grace_period_turns, max_instances_per_settlement) values
    (v_bp_granary,    v_world, 'Granary',           'granary',          'A raised granary that yields food passively and widens the field-hand rota.', 0, null),
    (v_bp_cistern,    v_world, 'Cistern',           'cistern',          'A stone cistern that gathers fresh water and supports the water-bearers.', 0, null),
    (v_bp_storehouse, v_world, 'Storehouse',        'storehouse',       'Roofed storage adding stockpile capacity for grain and cured goods.', 1, 4),
    (v_bp_workshop,   v_world, 'Weaver''s Workshop','weavers-workshop', 'A workshop where weavers raise the settlement''s cloth output.', 0, 4),
    (v_bp_longhouse,  v_world, 'Longhouse',         'longhouse',        'A communal hall that raises the settlement''s sustainable population.', 2, 8),
    (v_bp_smithy,     v_world, 'Smithy',            'smithy',           'A two-tier smithy that expands iron storage and bolsters the mason corps.', 1, 2);

  -- Building blueprint tiers -------------------------------------------
  insert into public.building_blueprint_tiers (
    id, building_blueprint_id, tier_number, worker_turns_required,
    construction_costs_json, upkeep_costs_json, effects_json
  ) values
    (v_tier_granary_1, v_bp_granary, 1, 6,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 10),
        jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount', 5)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','passive_resource_production','resource_id', v_res_food::text, 'amount', 16),
        jsonb_build_object('type','job_capacity_increase','job_id', v_job_field_hand::text, 'amount', 6),
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_food::text, 'amount', 800),
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_grain::text, 'amount', 400))),
    (v_tier_cistern_1, v_bp_cistern, 1, 5,
      jsonb_build_array(jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 8)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','passive_resource_production','resource_id', v_res_water::text, 'amount', 16),
        jsonb_build_object('type','job_capacity_increase','job_id', v_job_water_bearer::text, 'amount', 6),
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_water::text, 'amount', 800))),
    (v_tier_storehouse_1, v_bp_storehouse, 1, 4,
      jsonb_build_array(jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 20)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_grain::text, 'amount', 500),
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_salted_pork::text, 'amount', 250))),
    (v_tier_workshop_1, v_bp_workshop, 1, 5,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount', 8),
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 4)),
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('type','job_capacity_increase','job_id', v_job_cloth_weaver::text, 'amount', 3))),
    (v_tier_longhouse_1, v_bp_longhouse, 1, 8,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount', 15),
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 10)),
      jsonb_build_array(jsonb_build_object('resource_id', v_res_grain::text, 'amount', 2)),
      jsonb_build_array(jsonb_build_object('type','population_cap_increase','amount', 30))),
    (v_tier_smithy_1, v_bp_smithy, 1, 7,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_iron_ore::text, 'amount', 4),
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 6)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_iron_ore::text, 'amount', 100),
        jsonb_build_object('type','job_capacity_increase','job_id', v_job_stone_mason::text, 'amount', 1))),
    (v_tier_smithy_2, v_bp_smithy, 2, 12,
      jsonb_build_array(
        jsonb_build_object('resource_id', v_res_iron_ore::text, 'amount', 8),
        jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 12),
        jsonb_build_object('resource_id', v_res_copper_ingot::text, 'amount', 4)),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('type','resource_storage_increase','resource_id', v_res_iron_ore::text, 'amount', 250),
        jsonb_build_object('type','job_capacity_increase','job_id', v_job_stone_mason::text, 'amount', 2)));
end$$;

-- ---------------------------------------------------------------------------
-- 6. Settlement buildings: per settlement granary, cistern, storehouse, two
--    longhouses (+60 pop cap), a workshop; capital + highland hold also a
--    smithy and a third longhouse.
-- ---------------------------------------------------------------------------
do $$
declare
  v_setts uuid[] := array[
    '00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000306'];
  v_sid uuid;
  v_s int;
  v_bp_granary uuid := '00000000-0000-0000-0006-000000000101';
  v_bp_cistern uuid := '00000000-0000-0000-0006-000000000102';
  v_bp_store   uuid := '00000000-0000-0000-0006-000000000103';
  v_bp_work    uuid := '00000000-0000-0000-0006-000000000104';
  v_bp_long    uuid := '00000000-0000-0000-0006-000000000105';
  v_bp_smithy  uuid := '00000000-0000-0000-0006-000000000106';
  v_t_granary uuid := '00000000-0000-0000-0007-000000001011';
  v_t_cistern uuid := '00000000-0000-0000-0007-000000001021';
  v_t_store   uuid := '00000000-0000-0000-0007-000000001031';
  v_t_work    uuid := '00000000-0000-0000-0007-000000001041';
  v_t_long    uuid := '00000000-0000-0000-0007-000000001051';
  v_t_smithy  uuid := '00000000-0000-0000-0007-000000001061';
begin
  for v_s in 1..6 loop
    v_sid := v_setts[v_s];
    insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number) values
      (('00000000-0000-0000-000a-' || lpad((v_s*100+1)::text,12,'0'))::uuid, v_sid, v_bp_granary, v_t_granary, 'active', 0),
      (('00000000-0000-0000-000a-' || lpad((v_s*100+2)::text,12,'0'))::uuid, v_sid, v_bp_cistern, v_t_cistern, 'active', 0),
      (('00000000-0000-0000-000a-' || lpad((v_s*100+3)::text,12,'0'))::uuid, v_sid, v_bp_store,   v_t_store,   'active', 0),
      (('00000000-0000-0000-000a-' || lpad((v_s*100+4)::text,12,'0'))::uuid, v_sid, v_bp_work,    v_t_work,    'active', 0),
      (('00000000-0000-0000-000a-' || lpad((v_s*100+5)::text,12,'0'))::uuid, v_sid, v_bp_long,    v_t_long,    'active', 0),
      (('00000000-0000-0000-000a-' || lpad((v_s*100+6)::text,12,'0'))::uuid, v_sid, v_bp_long,    v_t_long,    'active', 0);
    if v_s = 1 or v_s = 6 then
      insert into public.settlement_buildings (id, settlement_id, building_blueprint_id, current_tier_id, state, activated_on_turn_number) values
        (('00000000-0000-0000-000a-' || lpad((v_s*100+7)::text,12,'0'))::uuid, v_sid, v_bp_long,   v_t_long,   'active', 0),
        (('00000000-0000-0000-000a-' || lpad((v_s*100+8)::text,12,'0'))::uuid, v_sid, v_bp_smithy, v_t_smithy, 'active', 0);
    end if;
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 7. Deposit instances + their resources.
-- ---------------------------------------------------------------------------
insert into public.deposit_instances (id, settlement_id, deposit_type_id, name, status, max_workers) values
  ('00000000-0000-0000-000c-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0008-000000000103','Aldercross Stone Quarry','active',10),
  ('00000000-0000-0000-000c-000000000002','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0008-000000000104','Wendlin Hardwood Grove','active',8),
  ('00000000-0000-0000-000c-000000000003','00000000-0000-0000-0000-000000000303','00000000-0000-0000-0008-000000000101','Bramhollow Iron Vein','active',8),
  ('00000000-0000-0000-000c-000000000004','00000000-0000-0000-0000-000000000304','00000000-0000-0000-0008-000000000102','Saltmere Copper Vein','active',6),
  ('00000000-0000-0000-000c-000000000005','00000000-0000-0000-0000-000000000305','00000000-0000-0000-0008-000000000105','Cobbleford Peat Bog','active',8),
  ('00000000-0000-0000-000c-000000000006','00000000-0000-0000-0000-000000000306','00000000-0000-0000-0008-000000000101','Carrick Iron Seam','active',10),
  ('00000000-0000-0000-000c-000000000007','00000000-0000-0000-0000-000000000306','00000000-0000-0000-0008-000000000105','Carrick Peat Bog','active',6);

insert into public.deposit_instance_resources (deposit_instance_id, resource_id, initial_quantity, remaining_quantity) values
  ('00000000-0000-0000-000c-000000000001','00000000-0000-0000-0004-000000000109', 8000, 8000),
  ('00000000-0000-0000-000c-000000000002','00000000-0000-0000-0004-000000000108', 4000, 4000),
  ('00000000-0000-0000-000c-000000000003','00000000-0000-0000-0004-000000000110', 5000, 5000),
  ('00000000-0000-0000-000c-000000000004','00000000-0000-0000-0004-000000000111', 2500, 2500),
  ('00000000-0000-0000-000c-000000000005','00000000-0000-0000-0004-000000000112', 3000, 3000),
  ('00000000-0000-0000-000c-000000000006','00000000-0000-0000-0004-000000000110', 4500, 4500),
  ('00000000-0000-0000-000c-000000000007','00000000-0000-0000-0004-000000000112', 2500, 2500);

-- ---------------------------------------------------------------------------
-- 8. Managed population instances.
-- ---------------------------------------------------------------------------
insert into public.managed_population_instances (id, settlement_id, managed_population_type_id, name, current_count, configured_cull_quantity, status) values
  ('00000000-0000-0000-000d-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0009-000000000101','Aldercross Flock', 80, 12, 'active'),
  ('00000000-0000-0000-000d-000000000002','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0009-000000000101','Wendlin Flock',   100, 10, 'active'),
  ('00000000-0000-0000-000d-000000000003','00000000-0000-0000-0000-000000000303','00000000-0000-0000-0009-000000000102','Bramhollow Apiary',60,  0, 'active'),
  ('00000000-0000-0000-000d-000000000004','00000000-0000-0000-0000-000000000304','00000000-0000-0000-0009-000000000103','Saltmere Drove',   50,  0, 'active'),
  ('00000000-0000-0000-000d-000000000005','00000000-0000-0000-0000-000000000305','00000000-0000-0000-0009-000000000103','Cobbleford Drove', 70,  8, 'active'),
  ('00000000-0000-0000-000d-000000000006','00000000-0000-0000-0000-000000000306','00000000-0000-0000-0009-000000000101','Carrick Flock',    90, 10, 'active');

-- ---------------------------------------------------------------------------
-- 9. Player characters (linked to the three seeded users) + a few notable
--    fixed-id NPCs used as trade approvers / relationship proposers, plus one
--    long-dead founder NPC.
-- ---------------------------------------------------------------------------
insert into public.citizens (
  id, world_id, settlement_id, citizen_type, given_name, surname, sex, status,
  born_on_turn_number, user_id, role_type, role_nation_id, role_settlement_id,
  personality_text, skills_text
)
values
  ('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301','player_character','Wynflaed','Hayward','female','alive',-29,'00000000-0000-0000-0000-000000000002','settlement_manager',null,'00000000-0000-0000-0000-000000000301','Pragmatic steward who keeps the Aldercross watch turning over.','Logistics, masonry, town-square diplomacy.'),
  ('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000302','player_character','Aldous','Pennington','male','alive',-37,'00000000-0000-0000-0000-000000000003','nation_manager','00000000-0000-0000-0000-000000000201',null,'Career reeve of Brammel; reads every charter twice.','Statecraft, ledger work, courtly debate.'),
  ('00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301','player_character','Kestrel','Crane','female','alive',-23,'00000000-0000-0000-0000-000000000001','none',null,null,'Wandering surveyor with no formal portfolio.','Cartography, surveying, quiet listening.');

insert into public.citizens (
  id, world_id, settlement_id, citizen_type, given_name, surname, sex, status,
  born_on_turn_number, npc_trait_1, npc_trait_2, npc_secret_contradiction, npc_goal, npc_flaw
)
values
  ('00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000304','npc','Mirella','Saltkeel','female','alive',-40,'shrewd','courtly','owes a debt to those they hunt','a seat on the council','pride'),
  ('00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000306','npc','Tavish','Carrick','male','alive',-38,'stoic','watchful','holds a vow they cannot recall','to raise the standing stones again','miserliness at home'),
  ('00000000-0000-0000-0000-000000000413','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301','npc','Aldous','Marrow','male','alive',-44,'patient','wry','loves their rival','to restore the family name','an addiction to risk');

insert into public.citizens (
  id, world_id, settlement_id, citizen_type, given_name, surname, sex, status,
  born_on_turn_number, death_cause, death_cause_category,
  npc_trait_1, npc_trait_2, npc_secret_contradiction, npc_goal, npc_flaw
)
values
  ('00000000-0000-0000-0000-000000000431','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000302','npc','Wynflaed','Quill','female','dead',-70,'Died peacefully during the first hard winter after the founding.','unknown'::public.death_cause_category,'weary','tender','keeps a portrait they never named','to die at home and not on the road','an inability to forgive the dead');

-- ---------------------------------------------------------------------------
-- 10. Bulk NPC population (~219) drawn from the culture namesets. Each
--     settlement gets a number of family couples (active partnership + shared
--     surname) and a number of children with parent links, plus the remainder
--     as adults. Deterministic UUIDs in the 0a00 group; flavor from the world
--     pool. v_seq is a global counter; v_couple a global couple counter.
-- ---------------------------------------------------------------------------
do $$
declare
  v_world constant uuid := '00000000-0000-0000-0000-000000000101';
  v_traits text[] := array['earnest','wry','patient','haunted','boisterous','stoic','tender','shrewd','blunt','watchful','scrappy','courtly','weary','fervent','soft-spoken'];
  v_contra text[] := array['mourns a friend they betrayed','loves their rival','shelters a soldier they once fought','keeps a portrait they never named','holds a vow they cannot recall','owes a debt to those they hunt','hides a wound that should have killed them','writes letters to a silent god'];
  v_goals  text[] := array['a seat on the council','to restore the family name','to walk the south road once more','to read the unburned library','to outlive every captain','to apprentice a child of the lower ward','to see the long winter end','to die at home and not on the road','to repay the gold lender of Mistfall','to raise the standing stones again'];
  v_flaws  text[] := array['pride','envy','an addiction to risk','a quiet drinking habit','an inability to forgive the dead','a temper that surfaces in writing','a need to be the cleverest voice','miserliness at home','reads every silence as betrayal','certainty they alone hold the line'];

  v_cfg record;
  v_male text[]; v_female text[]; v_surn text[];
  v_nm int; v_nf int; v_ns int; v_nt int; v_nc int; v_ng int; v_nl int;
  v_nameset uuid;
  v_seq bigint := 0;
  v_couple bigint := 0;
  c int;
  v_surname text;
  v_male_id uuid; v_female_id uuid; v_child_id uuid;
  v_mborn int; v_fborn int;
begin
  v_nt := array_length(v_traits,1); v_nc := array_length(v_contra,1);
  v_ng := array_length(v_goals,1);  v_nl := array_length(v_flaws,1);

  for v_cfg in
    select * from (values
      ('00000000-0000-0000-0000-000000000301'::uuid, 1, 19, 12),
      ('00000000-0000-0000-0000-000000000302'::uuid, 1, 13,  8),
      ('00000000-0000-0000-0000-000000000303'::uuid, 1, 13,  8),
      ('00000000-0000-0000-0000-000000000304'::uuid, 2, 15,  9),
      ('00000000-0000-0000-0000-000000000305'::uuid, 2, 12,  7),
      ('00000000-0000-0000-0000-000000000306'::uuid, 3, 12,  7)
    ) as t(sid, culture, couples, children)
  loop
    select male, female, surnames into v_male, v_female, v_surn from tmp_pools where culture = v_cfg.culture;
    v_nm := array_length(v_male,1); v_nf := array_length(v_female,1); v_ns := array_length(v_surn,1);
    v_nameset := ('00000000-0000-0000-0000-00000000070' || v_cfg.culture)::uuid;

    for c in 1..v_cfg.couples loop
      v_couple := v_couple + 1;
      v_surname := v_surn[1 + (v_couple % v_ns)];
      v_mborn := -(20 + ((v_couple * 5) % 45));
      v_fborn := -(18 + ((v_couple * 7) % 42));

      v_seq := v_seq + 1;
      v_male_id := ('00000000-0000-0000-0a00-' || lpad(v_seq::text,12,'0'))::uuid;
      insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, npc_trait_1, npc_trait_2, npc_secret_contradiction, npc_goal, npc_flaw)
      values (v_male_id, v_world, v_cfg.sid, 'npc', v_male[1 + (v_couple % v_nm)], v_surname, 'male', 'alive', v_mborn, v_nameset,
              v_traits[1+(v_seq % v_nt)], v_traits[1+((v_seq+5) % v_nt)], v_contra[1+(v_seq % v_nc)], v_goals[1+(v_seq % v_ng)], v_flaws[1+(v_seq % v_nl)]);

      v_seq := v_seq + 1;
      v_female_id := ('00000000-0000-0000-0a00-' || lpad(v_seq::text,12,'0'))::uuid;
      insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, npc_trait_1, npc_trait_2, npc_secret_contradiction, npc_goal, npc_flaw)
      values (v_female_id, v_world, v_cfg.sid, 'npc', v_female[1 + ((v_couple*3) % v_nf)], v_surname, 'female', 'alive', v_fborn, v_nameset,
              v_traits[1+(v_seq % v_nt)], v_traits[1+((v_seq+7) % v_nt)], v_contra[1+(v_seq % v_nc)], v_goals[1+(v_seq % v_ng)], v_flaws[1+(v_seq % v_nl)]);

      -- active partnership for every couple (each citizen in exactly one)
      insert into public.partnerships (citizen_a_id, citizen_b_id, status, formed_on_turn_number)
      values (v_male_id, v_female_id, 'active', greatest(v_mborn, v_fborn) + 18);

      -- a child for the first N couples of this settlement
      if c <= v_cfg.children then
        v_seq := v_seq + 1;
        v_child_id := ('00000000-0000-0000-0a00-' || lpad(v_seq::text,12,'0'))::uuid;
        insert into public.citizens (id, world_id, settlement_id, citizen_type, given_name, surname, sex, status, born_on_turn_number, nameset_id, parent_a_citizen_id, parent_b_citizen_id, npc_trait_1, npc_goal)
        values (v_child_id, v_world, v_cfg.sid, 'npc',
                case when c % 2 = 0 then v_male[1 + ((v_couple+4) % v_nm)] else v_female[1 + ((v_couple+2) % v_nf)] end,
                v_surname,
                case when c % 2 = 0 then 'male' else 'female' end,
                'alive', -(1 + (c % 12)), v_nameset, v_male_id, v_female_id,
                v_traits[1+(v_seq % v_nt)], v_goals[1+(v_seq % v_ng)]);
      end if;
    end loop;
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 11. Stockpiles. The (settlement x resource) rows already exist at qty 0
--     (auto-seeded by triggers); set starting quantities per resource slug,
--     including the system Food / Fresh Water resources resolved by slug.
-- ---------------------------------------------------------------------------
do $$
declare
  v_world constant uuid := '00000000-0000-0000-0000-000000000101';
  r record;
begin
  for r in select * from (values
    ('food',150),('fresh-water',150),('grain',400),('ale',60),('wool',150),
    ('linen-cloth',40),('hardwood-logs',250),('stone-block',300),('iron-ore',120),
    ('copper-ingot',50),('salted-pork',80),('smoked-mutton',60),('honey',60),
    ('peat',100),('sea-salt',60)
  ) as t(slug, qty) loop
    update public.settlement_resource_stockpiles s
    set quantity = r.qty
    from public.resources res
    where res.world_id = v_world and res.slug = r.slug and s.resource_id = res.id;
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 12. Construction projects: one in-progress longhouse per settlement (raises
--     future pop cap), with varied partial progress.
-- ---------------------------------------------------------------------------
insert into public.construction_projects (id, settlement_id, building_blueprint_id, target_tier_id, status, queue_position, progress_worker_turns) values
  ('00000000-0000-0000-000b-000000000001','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0006-000000000105','00000000-0000-0000-0007-000000001051','in_progress',1,3),
  ('00000000-0000-0000-000b-000000000002','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0006-000000000105','00000000-0000-0000-0007-000000001051','in_progress',1,2),
  ('00000000-0000-0000-000b-000000000003','00000000-0000-0000-0000-000000000303','00000000-0000-0000-0006-000000000105','00000000-0000-0000-0007-000000001051','in_progress',1,1),
  ('00000000-0000-0000-000b-000000000004','00000000-0000-0000-0000-000000000304','00000000-0000-0000-0006-000000000105','00000000-0000-0000-0007-000000001051','in_progress',1,2),
  ('00000000-0000-0000-000b-000000000005','00000000-0000-0000-0000-000000000305','00000000-0000-0000-0006-000000000105','00000000-0000-0000-0007-000000001051','in_progress',1,0),
  ('00000000-0000-0000-000b-000000000006','00000000-0000-0000-0000-000000000306','00000000-0000-0000-0006-000000000105','00000000-0000-0000-0007-000000001051','in_progress',1,4);

-- ---------------------------------------------------------------------------
-- 13. Nation relationships. Bilateral mirror trigger suppressed so both
--     directional rows are written explicitly.
--     Brammel(201) <-> Carrowmoor(203): allied.
--     Brammel(201) <-> Caldhaven(202): friendly.
--     Caldhaven(202) -> Carrowmoor(203): pending non-aggression-pact proposal.
-- ---------------------------------------------------------------------------
select set_config('app.skip_bilateral_mirror', 'true', false);
insert into public.nation_relationships (id, from_nation_id, to_nation_id, world_id, current_stance, pending_stance, pending_status, pending_changed_by_citizen_id) values
  ('00000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000101','allied','allied','accepted','00000000-0000-0000-0000-000000000402'),
  ('00000000-0000-0000-0000-000000000602','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','allied',null,null,null),
  ('00000000-0000-0000-0000-000000000603','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000101','friendly',null,null,null),
  ('00000000-0000-0000-0000-000000000604','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','friendly',null,null,null),
  ('00000000-0000-0000-0000-000000000605','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000101','neutral','non_aggression_pact','proposed','00000000-0000-0000-0000-000000000411');
select set_config('app.skip_bilateral_mirror', 'false', false);

-- ---------------------------------------------------------------------------
-- 14. Trade routes + legs.
--     A active: Aldercross(301) -> Saltmere(304), grain.
--     B proposed: Bramhollow(303) -> Carrick Hold(306), wool.
--     C active: Saltmere(304) -> Aldercross(301), sea salt.
-- ---------------------------------------------------------------------------
insert into public.trade_routes (
  id, origin_settlement_id, destination_settlement_id, status, proposed_by_citizen_id,
  origin_approval_status, destination_approval_status, origin_approved_by_citizen_id, destination_approved_by_citizen_id
) values
  ('00000000-0000-0000-000e-000000000101','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000304','active','00000000-0000-0000-0000-000000000401','approved','approved','00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000411'),
  ('00000000-0000-0000-000e-000000000102','00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000306','proposed','00000000-0000-0000-0000-000000000401','pending','pending',null,null),
  ('00000000-0000-0000-000e-000000000103','00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000301','active','00000000-0000-0000-0000-000000000402','approved','approved','00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000413');

insert into public.trade_route_legs (trade_route_id, direction, resource_id, quantity_per_transition) values
  ('00000000-0000-0000-000e-000000000101','send','00000000-0000-0000-0004-000000000101',25),
  ('00000000-0000-0000-000e-000000000102','send','00000000-0000-0000-0004-000000000107',15),
  ('00000000-0000-0000-000e-000000000103','send','00000000-0000-0000-0004-000000000113',20);

-- ---------------------------------------------------------------------------
-- 15. Citizen assignments. Priority order guarantees food/water staffing first,
--     then grain, deposits, husbandry/culling, construction pool, then the
--     ale/cloth chains, clamped to each settlement's available adults.
-- ---------------------------------------------------------------------------
do $$
declare
  v_cfg record;
  v_ids uuid[];
  v_n int;
  v_idx int;
  j int; k int;
  v_jobs1 uuid[]; v_cnts1 int[];
  v_jobs2 uuid[]; v_cnts2 int[];
  dep record; pop record;
  v_field uuid := '00000000-0000-0000-0005-000000000101';
  v_water uuid := '00000000-0000-0000-0005-000000000102';
  v_grain uuid := '00000000-0000-0000-0005-000000000103';
  v_brewer uuid := '00000000-0000-0000-0005-000000000104';
  v_weaver uuid := '00000000-0000-0000-0005-000000000105';
begin
  for v_cfg in select * from (values
    ('00000000-0000-0000-0000-000000000301'::uuid, 14, 10),
    ('00000000-0000-0000-0000-000000000302'::uuid, 10,  8),
    ('00000000-0000-0000-0000-000000000303'::uuid, 10,  8),
    ('00000000-0000-0000-0000-000000000304'::uuid, 10,  8),
    ('00000000-0000-0000-0000-000000000305'::uuid, 10,  8),
    ('00000000-0000-0000-0000-000000000306'::uuid, 10,  8)
  ) as t(sid, fld, wtr) loop
    v_ids := array(select id from public.citizens
                   where settlement_id = v_cfg.sid and citizen_type = 'npc'
                     and status = 'alive' and born_on_turn_number <= -16
                     and id not in (select citizen_id from public.citizen_assignments)
                   order by born_on_turn_number, id);
    v_n := coalesce(array_length(v_ids,1), 0);
    v_idx := 1;

    -- food / water / grain (highest priority)
    v_jobs1 := array[v_field, v_water, v_grain];
    v_cnts1 := array[v_cfg.fld, v_cfg.wtr, 3];
    for j in 1..array_length(v_jobs1,1) loop
      for k in 1..v_cnts1[j] loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'standard_job', v_jobs1[j], 0);
        v_idx := v_idx + 1;
      end loop;
    end loop;

    -- deposits: 2 workers per deposit instance
    for dep in select di.id did from public.deposit_instances di where di.settlement_id = v_cfg.sid and di.status = 'active' loop
      for k in 1..2 loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'deposit', dep.did, 0);
        v_idx := v_idx + 1;
      end loop;
    end loop;

    -- husbandry (2) + culling (1 if a cull quota is set) per managed population
    for pop in select mpi.id mid, mpi.configured_cull_quantity cq from public.managed_population_instances mpi where mpi.settlement_id = v_cfg.sid and mpi.status = 'active' loop
      for k in 1..2 loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'husbandry', pop.mid, 0);
        v_idx := v_idx + 1;
      end loop;
      if pop.cq > 0 and v_idx <= v_n then
        insert into public.citizen_assignments (citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'culling', pop.mid, 0);
        v_idx := v_idx + 1;
      end if;
    end loop;

    -- construction pool (3 unallocated workers)
    for k in 1..3 loop
      exit when v_idx > v_n;
      insert into public.citizen_assignments (citizen_id, assignment_type, construction_project_id, assigned_on_turn_number)
      values (v_ids[v_idx], 'construction_project', null, 0);
      v_idx := v_idx + 1;
    end loop;

    -- ale + cloth chains (lowest priority)
    v_jobs2 := array[v_brewer, v_weaver];
    v_cnts2 := array[2, 2];
    for j in 1..array_length(v_jobs2,1) loop
      for k in 1..v_cnts2[j] loop
        exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'standard_job', v_jobs2[j], 0);
        v_idx := v_idx + 1;
      end loop;
    end loop;
  end loop;
end$$;

-- Trade-route worker assignments (one per endpoint, settlement must match end).
do $$
declare
  r record;
  v_cid uuid;
begin
  for r in select * from (values
    ('00000000-0000-0000-000e-000000000101'::uuid, 'origin',      '00000000-0000-0000-0000-000000000301'::uuid),
    ('00000000-0000-0000-000e-000000000101'::uuid, 'destination', '00000000-0000-0000-0000-000000000304'::uuid),
    ('00000000-0000-0000-000e-000000000102'::uuid, 'origin',      '00000000-0000-0000-0000-000000000303'::uuid),
    ('00000000-0000-0000-000e-000000000102'::uuid, 'destination', '00000000-0000-0000-0000-000000000306'::uuid),
    ('00000000-0000-0000-000e-000000000103'::uuid, 'origin',      '00000000-0000-0000-0000-000000000304'::uuid),
    ('00000000-0000-0000-000e-000000000103'::uuid, 'destination', '00000000-0000-0000-0000-000000000301'::uuid)
  ) as t(route, e, sid) loop
    select id into v_cid from public.citizens
      where settlement_id = r.sid and citizen_type = 'npc' and status = 'alive'
        and born_on_turn_number <= -16
        and id not in (select citizen_id from public.citizen_assignments)
      order by born_on_turn_number, id limit 1;
    if v_cid is not null then
      insert into public.citizen_assignments (citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number)
      values (v_cid, 'trade_route', r.route, r.e, 0);
    end if;
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 16. Active player-character mappings (super admin intentionally omitted).
-- ---------------------------------------------------------------------------
insert into public.user_active_player_characters (user_id, world_id, citizen_id) values
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000401'),
  ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000402');

-- ---------------------------------------------------------------------------
-- 17. World admins (all three seeded users administer Aldermoor so the reports
--     RLS path is reachable for every demo account).
-- ---------------------------------------------------------------------------
insert into public.world_admins (world_id, user_id) values
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000003');
