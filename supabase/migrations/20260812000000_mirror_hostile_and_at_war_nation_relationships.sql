-- Migration: mirror_hostile_and_at_war_nation_relationships
-- Fixes #955: at_war and hostile stances were not mirrored to the reciprocal
-- nation_relationships row, so nation A could show at_war toward B while B's
-- row toward A still read neutral.
--
-- Domain decision:
--   Conflict is inherently mutual. A nation cannot be "at war" with another
--   nation that is not, by definition, also at war with it, and the same
--   reasoning applies to hostile (an active antagonistic posture, distinct
--   from the passive default of neutral). Combat resolution and any other
--   simulation logic that reads a nation's relationships needs both
--   directional rows to agree on conflict state. hostile and at_war are
--   therefore folded into the existing bilateral-mirror set alongside allied
--   and non_aggression_pact.
--
--   friendly and neutral remain intentionally directional/asymmetric: they
--   express one nation's unilateral disposition toward another (A can regard
--   B as friendly while B has not reciprocated), and no simulation logic
--   requires them to agree. This asymmetry is by design, not a bug.
-- ---------------------------------------------------------------------------
-- Extend the mirror trigger function to include hostile and at_war in both
-- the forward-mirror branch and the reverse-clear branch.
-- ---------------------------------------------------------------------------
create or replace function public.mirror_bilateral_nation_relationship_stance () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if current_setting('app.skip_bilateral_mirror', true) = 'true' then
    return null;
  end if;

  perform set_config('app.skip_bilateral_mirror', 'true', true);

  if new.current_stance in ('allied', 'non_aggression_pact', 'hostile', 'at_war') then
    insert into
      public.nation_relationships (
        from_nation_id,
        to_nation_id,
        current_stance,
        pending_stance,
        pending_status,
        pending_changed_by_citizen_id
      )
    values
      (
        new.to_nation_id,
        new.from_nation_id,
        new.current_stance,
        null,
        null,
        null
      )
    on conflict (from_nation_id, to_nation_id) do update
    set
      current_stance = excluded.current_stance,
      pending_stance = null,
      pending_status = null,
      pending_changed_by_citizen_id = null;
  elsif tg_op = 'UPDATE'
    and old.current_stance in ('allied', 'non_aggression_pact', 'hostile', 'at_war')
    and new.current_stance not in ('allied', 'non_aggression_pact', 'hostile', 'at_war')
  then
    -- Clear the symmetric row back to neutral only when it still carries the
    -- mirrored stance. This handles withdrawFromBilateral, setUnilateralStance
    -- overriding a bilateral, and de-escalating away from hostile/at_war.
    update public.nation_relationships
    set
      current_stance = 'neutral',
      pending_stance = null,
      pending_status = null,
      pending_changed_by_citizen_id = null
    where
      from_nation_id = new.to_nation_id
      and to_nation_id = new.from_nation_id
      and current_stance in ('allied', 'non_aggression_pact', 'hostile', 'at_war');
  end if;

  perform set_config('app.skip_bilateral_mirror', 'false', true);

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: reconcile existing divergent pairs where one direction already
-- carries hostile/at_war but the reciprocal row does not agree. When the two
-- directions disagree on conflict severity, the worse state wins (at_war
-- outranks hostile) so an existing declaration of war is never downgraded.
-- ---------------------------------------------------------------------------
insert into
  public.nation_relationships (from_nation_id, to_nation_id, current_stance)
select
  nr.to_nation_id,
  nr.from_nation_id,
  nr.current_stance
from
  public.nation_relationships nr
where
  nr.current_stance in ('hostile', 'at_war')
on conflict (from_nation_id, to_nation_id) do update
set
  current_stance = excluded.current_stance,
  pending_stance = null,
  pending_status = null,
  pending_changed_by_citizen_id = null
where
  (
    case nation_relationships.current_stance
      when 'at_war' then 2
      when 'hostile' then 1
      else 0
    end
  ) < (
    case excluded.current_stance
      when 'at_war' then 2
      when 'hostile' then 1
      else 0
    end
  );
