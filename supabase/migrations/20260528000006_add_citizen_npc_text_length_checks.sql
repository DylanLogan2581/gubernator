-- Migration: add_citizen_npc_text_length_checks
-- Enforces maximum lengths on the per-citizen NPC text columns introduced in
-- 20260520000000_add_citizens.sql. Limits mirror the constants in
-- `src/lib/inputLimits.ts`; keep them in sync.
alter table public.citizens
add constraint citizens_personality_text_max_length_check check (
  personality_text is null
  or char_length(personality_text) <= 1000
),
add constraint citizens_skills_text_max_length_check check (
  skills_text is null
  or char_length(skills_text) <= 1000
),
add constraint citizens_npc_trait_1_max_length_check check (
  npc_trait_1 is null
  or char_length(npc_trait_1) <= 200
),
add constraint citizens_npc_trait_2_max_length_check check (
  npc_trait_2 is null
  or char_length(npc_trait_2) <= 200
),
add constraint citizens_npc_secret_contradiction_max_length_check check (
  npc_secret_contradiction is null
  or char_length(npc_secret_contradiction) <= 1000
),
add constraint citizens_npc_goal_max_length_check check (
  npc_goal is null
  or char_length(npc_goal) <= 1000
),
add constraint citizens_npc_flaw_max_length_check check (
  npc_flaw is null
  or char_length(npc_flaw) <= 1000
),
add constraint citizens_death_cause_max_length_check check (
  death_cause is null
  or char_length(death_cause) <= 1000
);
