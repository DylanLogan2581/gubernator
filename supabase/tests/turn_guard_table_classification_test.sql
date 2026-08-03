-- pgTAP: the turn-guard classification must name every base table in public
-- exactly once. A table added without a classification fails here, which is
-- what stops a new table from silently landing unguarded.
begin;

select
  plan (5);

-- The function exists and returns the expected shape.
select
  has_function (
    'public',
    'internal_turn_guard_classification',
    array[]::text[]
  );

-- Every classified name is a real, non-partition base table in public.
select
  is_empty (
    $$
    select c.table_name
    from public.internal_turn_guard_classification() c
    where not exists (
      select 1
      from pg_class pc
      join pg_namespace pn on pn.oid = pc.relnamespace
      where pn.nspname = 'public'
        and pc.relkind = 'r'
        and not pc.relispartition
        and pc.relname = c.table_name
    )
  $$,
    'classification names only real public base tables'
  );

-- Every real base table is classified.
select
  is_empty (
    $$
    select pc.relname
    from pg_class pc
    join pg_namespace pn on pn.oid = pc.relnamespace
    where pn.nspname = 'public'
      and pc.relkind = 'r'
      and not pc.relispartition
      and not exists (
        select 1 from public.internal_turn_guard_classification() c
        where c.table_name = pc.relname
      )
  $$,
    'every public base table is classified'
  );

-- No table is classified twice.
select
  is_empty (
    $$
    select table_name
    from public.internal_turn_guard_classification()
    group by table_name
    having count(*) > 1
  $$,
    'no table is classified more than once'
  );

-- Guarded rows carry a resolver; non-guarded rows do not.
select
  is_empty (
    $$
    select table_name
    from public.internal_turn_guard_classification()
    where (bucket = 'guarded' and (key_column is null or resolver_sql is null))
       or (bucket <> 'guarded' and (key_column is not null or resolver_sql is not null))
  $$,
    'guarded rows have a resolver and others do not'
  );

select
  *
from
  finish ();

rollback;
