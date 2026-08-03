-- Widen turn_transitions.progress_stage from four coarse stages to one value
-- per simulation phase. With the whole world blocked behind a progress
-- overlay, a bar that sits on 'simulating' for the bulk of the run reads as
-- hung. 'simulating' is retained so an in-flight transition written by an old
-- worker build still satisfies the constraint.
alter table public.turn_transitions
drop constraint if exists turn_transitions_progress_stage_check;

alter table public.turn_transitions
add constraint turn_transitions_progress_stage_check check (
  progress_stage is null
  or progress_stage in (
    'queued',
    'loading',
    'simulating',
    'persisting',
    'standard_jobs',
    'deposit_extraction',
    'construction',
    'building_upkeep',
    'education',
    'passive_effects',
    'trade_routes',
    'national_economy',
    'treaties',
    'managed_populations',
    'military_upkeep',
    'citizen_consumption',
    'partnerships',
    'homelessness',
    'events',
    'stockpile_clamp',
    'resource_decay',
    'succession',
    'treaty_marriage_notes',
    'logs_and_snapshots'
  )
);

comment on column public.turn_transitions.progress_stage is 'Progress of the background turn worker while status = ''running'': a queue/load/persist stage, or the simulation phase currently executing. Null once the transition reaches a terminal status. Written by the worker (service role); readable through the existing world-access select policy.';
