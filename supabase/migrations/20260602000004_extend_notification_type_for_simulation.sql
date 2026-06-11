-- Migration: extend_notification_type_for_simulation
-- Adds Epic 6 simulation outcome notification types to the public.notification_type enum.
--
-- Per §11.14 of the simulation plan, citizen.born and citizen.died are reserved
-- for future per-citizen notification surfaces; Epic 6 emits only the
-- settlement-aggregate starvation/homelessness types.
-- ---------------------------------------------------------------------------
alter type public.notification_type
add value 'building.auto_deconstructed';

alter type public.notification_type
add value 'building.suspended';

alter type public.notification_type
add value 'citizen.born';

alter type public.notification_type
add value 'citizen.died';

alter type public.notification_type
add value 'construction.completed';

alter type public.notification_type
add value 'construction.paused';

alter type public.notification_type
add value 'deposit.depleted';

alter type public.notification_type
add value 'managed_population.declining';

alter type public.notification_type
add value 'managed_population.extinct';

alter type public.notification_type
add value 'partnership.formed';

alter type public.notification_type
add value 'partnership.widowed';

alter type public.notification_type
add value 'settlement.homelessness_occurred';

alter type public.notification_type
add value 'settlement.starvation_occurred';

alter type public.notification_type
add value 'trade_route.paused';

alter type public.notification_type
add value 'trade_route.resumed';
