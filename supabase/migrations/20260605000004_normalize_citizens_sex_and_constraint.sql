-- Migration: normalize_citizens_sex_and_constraint
-- Normalizes any existing citizens.sex values that were inserted with a
-- capitalized casing (e.g. "Male"/"Female") down to the lowercase form the
-- simulation expects, then adds a CHECK constraint so that future inserts
-- can only store NULL, 'male', or 'female'. Capitalized values caused
-- phasePartnerships formation to silently skip those citizens because the
-- simulation does strict equality against the lowercase strings.
-- ---------------------------------------------------------------------------
update public.citizens
set
  sex = lower(sex)
where
  sex is not null
  and sex <> lower(sex);

alter table public.citizens
add constraint citizens_sex_check check (
  sex is null
  or sex in ('male', 'female')
);
