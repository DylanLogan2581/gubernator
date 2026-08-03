-- Migration: add_job_required_education_level
-- #1102: job_definitions gain an optional minimum education level
-- requirement. Null means no requirement.
--
-- Qualification rule (enforced by a later issue -- assignment RPC +
-- simulation): a citizen qualifies for a job iff the citizen's education
-- level rank >= the job's required level rank. An uneducated (null level)
-- citizen only qualifies for jobs with no requirement.
alter table public.job_definitions
add column required_education_level_id uuid null constraint job_definitions_required_education_level_fk references public.education_levels (id) on delete set null;

create index job_definitions_required_education_level_id_idx on public.job_definitions (required_education_level_id);
