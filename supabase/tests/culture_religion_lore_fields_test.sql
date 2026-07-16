-- pgTAP tests for culture/religion lore fields added in
-- 20261116000000_add_culture_religion_lore_fields.sql.
-- Run with: npx supabase test db
begin;

select
  plan (13);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, status)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'Lore World',
    'active'
  );

insert into
  public.cultures (id, world_id, name)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'Lore Culture'
  );

insert into
  public.religions (id, world_id, name)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'Lore Religion'
  );

-- ---------------------------------------------------------------------------
-- cultures.origins accepts null / at limit / rejects over limit
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        origins is null
      from
        public.cultures
      where
        id = 'c2000000-0000-0000-0000-000000000001'
    ),
    'culture origins is null by default'
  );

select
  lives_ok (
    $test$
    update public.cultures
    set origins = repeat('o', 2000)
    where id = 'c2000000-0000-0000-0000-000000000001'
  $test$,
    'culture origins at 2000 chars accepted'
  );

select
  throws_ok (
    $test$
    update public.cultures
    set origins = repeat('o', 2001)
    where id = 'c2000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'culture origins over 2000 chars rejected'
  );

-- ---------------------------------------------------------------------------
-- cultures.core_values accepts null / at limit / rejects over limit
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    update public.cultures
    set core_values = repeat('c', 2000)
    where id = 'c2000000-0000-0000-0000-000000000001'
  $test$,
    'culture core_values at 2000 chars accepted'
  );

select
  throws_ok (
    $test$
    update public.cultures
    set core_values = repeat('c', 2001)
    where id = 'c2000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'culture core_values over 2000 chars rejected'
  );

select
  lives_ok (
    $test$
    update public.cultures
    set core_values = null
    where id = 'c2000000-0000-0000-0000-000000000001'
  $test$,
    'culture core_values can be reset to null'
  );

-- ---------------------------------------------------------------------------
-- cultures: full lore column set exists
-- ---------------------------------------------------------------------------
select
  columns_are (
    'public',
    'cultures',
    array[
      'id',
      'world_id',
      'name',
      'description',
      'color',
      'created_at',
      'updated_at',
      'origins',
      'demonym',
      'core_values',
      'taboos',
      'etiquette',
      'gender_family_norms',
      'attitudes_to_outsiders',
      'rites_of_passage',
      'festivals_holidays',
      'superstitions_folklore',
      'funerary_customs',
      'language_dialects',
      'naming_conventions',
      'sayings_idioms',
      'arts_aesthetics',
      'architecture_craftsmanship',
      'social_hierarchy',
      'leadership_occupations',
      'cuisine_meals',
      'dress_fashion'
    ],
    'cultures has all expected lore columns'
  );

-- ---------------------------------------------------------------------------
-- religions.deities accepts null / at limit / rejects over limit
-- ---------------------------------------------------------------------------
select
  ok (
    (
      select
        deities is null
      from
        public.religions
      where
        id = 'c3000000-0000-0000-0000-000000000001'
    ),
    'religion deities is null by default'
  );

select
  lives_ok (
    $test$
    update public.religions
    set deities = repeat('d', 2000)
    where id = 'c3000000-0000-0000-0000-000000000001'
  $test$,
    'religion deities at 2000 chars accepted'
  );

select
  throws_ok (
    $test$
    update public.religions
    set deities = repeat('d', 2001)
    where id = 'c3000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'religion deities over 2000 chars rejected'
  );

-- ---------------------------------------------------------------------------
-- religions.tenets accepts at limit / rejects over limit
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    update public.religions
    set tenets = repeat('t', 2000)
    where id = 'c3000000-0000-0000-0000-000000000001'
  $test$,
    'religion tenets at 2000 chars accepted'
  );

select
  throws_ok (
    $test$
    update public.religions
    set tenets = repeat('t', 2001)
    where id = 'c3000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'religion tenets over 2000 chars rejected'
  );

-- ---------------------------------------------------------------------------
-- religions: full lore column set exists
-- ---------------------------------------------------------------------------
select
  columns_are (
    'public',
    'religions',
    array[
      'id',
      'world_id',
      'name',
      'description',
      'color',
      'created_at',
      'updated_at',
      'deities',
      'creation_myth',
      'mythology',
      'tenets',
      'ethics_sins',
      'taboos',
      'virtues',
      'worship_practices',
      'rituals_ceremonies',
      'holy_days_festivals',
      'pilgrimage_devotions',
      'priesthood',
      'hierarchy_governance',
      'sects_schisms',
      'relationship_to_state',
      'afterlife_beliefs',
      'funerary_rites',
      'sacred_texts',
      'holy_sites',
      'symbols_vestments',
      'history_spread'
    ],
    'religions has all expected lore columns'
  );

rollback;
