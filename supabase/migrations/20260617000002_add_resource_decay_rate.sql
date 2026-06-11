-- Migration: add_resource_decay_rate
-- Adds an optional decay_rate column to the public.resources table.
-- Decay rate is a percentage (0-100) of stockpile lost each turn.
-- Default: 0 (no decay). Applied near end of turn transition after consumption.
-- ---------------------------------------------------------------------------
alter table public.resources
add column decay_rate numeric(5, 2) not null default 0 constraint resources_decay_rate_check check (
  decay_rate >= 0
  and decay_rate <= 100
);
