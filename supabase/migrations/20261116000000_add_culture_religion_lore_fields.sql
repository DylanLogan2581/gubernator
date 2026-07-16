-- Migration: add_culture_religion_lore_fields
-- Issue #1249: optional lore fields for cultures and religions, edited on a
-- dedicated detail page (accordion sections). Create/edit dialogs stay
-- minimal (name/description/color); these columns are only ever written via
-- the update path. All nullable text, capped at 2000 chars each. No RLS
-- changes needed -- existing row policies on cultures/religions already
-- cover these new columns.
-- ---------------------------------------------------------------------------
-- cultures
-- ---------------------------------------------------------------------------
alter table public.cultures
add column origins text,
add column demonym text,
add column core_values text,
add column taboos text,
add column etiquette text,
add column gender_family_norms text,
add column attitudes_to_outsiders text,
add column rites_of_passage text,
add column festivals_holidays text,
add column superstitions_folklore text,
add column funerary_customs text,
add column language_dialects text,
add column naming_conventions text,
add column sayings_idioms text,
add column arts_aesthetics text,
add column architecture_craftsmanship text,
add column social_hierarchy text,
add column leadership_occupations text,
add column cuisine_meals text,
add column dress_fashion text,
add constraint cultures_origins_max_length_check check (
  origins is null
  or char_length(origins) <= 2000
),
add constraint cultures_demonym_max_length_check check (
  demonym is null
  or char_length(demonym) <= 2000
),
add constraint cultures_core_values_max_length_check check (
  core_values is null
  or char_length(core_values) <= 2000
),
add constraint cultures_taboos_max_length_check check (
  taboos is null
  or char_length(taboos) <= 2000
),
add constraint cultures_etiquette_max_length_check check (
  etiquette is null
  or char_length(etiquette) <= 2000
),
add constraint cultures_gender_family_norms_max_length_check check (
  gender_family_norms is null
  or char_length(gender_family_norms) <= 2000
),
add constraint cultures_attitudes_to_outsiders_max_length_check check (
  attitudes_to_outsiders is null
  or char_length(attitudes_to_outsiders) <= 2000
),
add constraint cultures_rites_of_passage_max_length_check check (
  rites_of_passage is null
  or char_length(rites_of_passage) <= 2000
),
add constraint cultures_festivals_holidays_max_length_check check (
  festivals_holidays is null
  or char_length(festivals_holidays) <= 2000
),
add constraint cultures_superstitions_folklore_max_length_check check (
  superstitions_folklore is null
  or char_length(superstitions_folklore) <= 2000
),
add constraint cultures_funerary_customs_max_length_check check (
  funerary_customs is null
  or char_length(funerary_customs) <= 2000
),
add constraint cultures_language_dialects_max_length_check check (
  language_dialects is null
  or char_length(language_dialects) <= 2000
),
add constraint cultures_naming_conventions_max_length_check check (
  naming_conventions is null
  or char_length(naming_conventions) <= 2000
),
add constraint cultures_sayings_idioms_max_length_check check (
  sayings_idioms is null
  or char_length(sayings_idioms) <= 2000
),
add constraint cultures_arts_aesthetics_max_length_check check (
  arts_aesthetics is null
  or char_length(arts_aesthetics) <= 2000
),
add constraint cultures_architecture_craftsmanship_max_length_check check (
  architecture_craftsmanship is null
  or char_length(architecture_craftsmanship) <= 2000
),
add constraint cultures_social_hierarchy_max_length_check check (
  social_hierarchy is null
  or char_length(social_hierarchy) <= 2000
),
add constraint cultures_leadership_occupations_max_length_check check (
  leadership_occupations is null
  or char_length(leadership_occupations) <= 2000
),
add constraint cultures_cuisine_meals_max_length_check check (
  cuisine_meals is null
  or char_length(cuisine_meals) <= 2000
),
add constraint cultures_dress_fashion_max_length_check check (
  dress_fashion is null
  or char_length(dress_fashion) <= 2000
);

-- ---------------------------------------------------------------------------
-- religions
-- ---------------------------------------------------------------------------
alter table public.religions
add column deities text,
add column creation_myth text,
add column mythology text,
add column tenets text,
add column ethics_sins text,
add column taboos text,
add column virtues text,
add column worship_practices text,
add column rituals_ceremonies text,
add column holy_days_festivals text,
add column pilgrimage_devotions text,
add column priesthood text,
add column hierarchy_governance text,
add column sects_schisms text,
add column relationship_to_state text,
add column afterlife_beliefs text,
add column funerary_rites text,
add column sacred_texts text,
add column holy_sites text,
add column symbols_vestments text,
add column history_spread text,
add constraint religions_deities_max_length_check check (
  deities is null
  or char_length(deities) <= 2000
),
add constraint religions_creation_myth_max_length_check check (
  creation_myth is null
  or char_length(creation_myth) <= 2000
),
add constraint religions_mythology_max_length_check check (
  mythology is null
  or char_length(mythology) <= 2000
),
add constraint religions_tenets_max_length_check check (
  tenets is null
  or char_length(tenets) <= 2000
),
add constraint religions_ethics_sins_max_length_check check (
  ethics_sins is null
  or char_length(ethics_sins) <= 2000
),
add constraint religions_taboos_max_length_check check (
  taboos is null
  or char_length(taboos) <= 2000
),
add constraint religions_virtues_max_length_check check (
  virtues is null
  or char_length(virtues) <= 2000
),
add constraint religions_worship_practices_max_length_check check (
  worship_practices is null
  or char_length(worship_practices) <= 2000
),
add constraint religions_rituals_ceremonies_max_length_check check (
  rituals_ceremonies is null
  or char_length(rituals_ceremonies) <= 2000
),
add constraint religions_holy_days_festivals_max_length_check check (
  holy_days_festivals is null
  or char_length(holy_days_festivals) <= 2000
),
add constraint religions_pilgrimage_devotions_max_length_check check (
  pilgrimage_devotions is null
  or char_length(pilgrimage_devotions) <= 2000
),
add constraint religions_priesthood_max_length_check check (
  priesthood is null
  or char_length(priesthood) <= 2000
),
add constraint religions_hierarchy_governance_max_length_check check (
  hierarchy_governance is null
  or char_length(hierarchy_governance) <= 2000
),
add constraint religions_sects_schisms_max_length_check check (
  sects_schisms is null
  or char_length(sects_schisms) <= 2000
),
add constraint religions_relationship_to_state_max_length_check check (
  relationship_to_state is null
  or char_length(relationship_to_state) <= 2000
),
add constraint religions_afterlife_beliefs_max_length_check check (
  afterlife_beliefs is null
  or char_length(afterlife_beliefs) <= 2000
),
add constraint religions_funerary_rites_max_length_check check (
  funerary_rites is null
  or char_length(funerary_rites) <= 2000
),
add constraint religions_sacred_texts_max_length_check check (
  sacred_texts is null
  or char_length(sacred_texts) <= 2000
),
add constraint religions_holy_sites_max_length_check check (
  holy_sites is null
  or char_length(holy_sites) <= 2000
),
add constraint religions_symbols_vestments_max_length_check check (
  symbols_vestments is null
  or char_length(symbols_vestments) <= 2000
),
add constraint religions_history_spread_max_length_check check (
  history_spread is null
  or char_length(history_spread) <= 2000
);
