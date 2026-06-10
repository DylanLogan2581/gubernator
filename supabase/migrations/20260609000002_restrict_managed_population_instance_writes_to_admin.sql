-- Migration: restrict_managed_population_instance_writes_to_admin
-- Drops manager-path INSERT / UPDATE / DELETE policies on
-- managed_population_instances so that direct table writes are admin-only.
-- Managers continue to control cull settings via the SECURITY DEFINER
-- set_configured_cull_quantity RPC.
-- Ref: issue #575
-- ---------------------------------------------------------------------------
-- Drop manager-path write policies.
drop policy "managed_population_instances_insert_manager" on public.managed_population_instances;

drop policy "managed_population_instances_update_manager" on public.managed_population_instances;

drop policy "managed_population_instances_delete_manager" on public.managed_population_instances;

-- Add admin-only DELETE policy (the dropped manager policy was the only DELETE
-- policy; INSERT and UPDATE admin policies already exist).
create policy "managed_population_instances_delete_admin" on public.managed_population_instances for delete to authenticated using (
  exists (
    select
      1
    from
      public.settlements s
      join public.nations n on n.id = s.nation_id
    where
      s.id = managed_population_instances.settlement_id
      and (
        public.is_world_admin (n.world_id)
        or public.is_super_admin ()
      )
  )
);
