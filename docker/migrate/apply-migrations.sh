#!/bin/sh
# Applies supabase/migrations/*.sql in filename order, tracking applied
# versions in supabase_migrations.schema_migrations (same table the
# Supabase CLI uses, so `supabase db push` stays compatible).
# Idempotent: safe to run on every `docker compose up`.
set -eu

export PGHOST="${POSTGRES_HOST:-db}"
export PGPORT="${POSTGRES_PORT:-5432}"
export PGUSER=postgres
export PGDATABASE="${POSTGRES_DB:-postgres}"
# PGPASSWORD supplied by compose

echo "Waiting for Postgres at ${PGHOST}:${PGPORT}..."
until pg_isready -q; do
  sleep 1
done

psql -v ON_ERROR_STOP=1 -q <<'SQL'
create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
SQL

applied=0
for f in /migrations/*.sql; do
  base=$(basename "$f" .sql)
  version=${base%%_*}
  name=${base#*_}

  exists=$(psql -tAc "select 1 from supabase_migrations.schema_migrations where version = '$version'")
  if [ "$exists" = "1" ]; then
    continue
  fi

  echo "Applying migration $base"
  {
    cat "$f"
    printf "\ninsert into supabase_migrations.schema_migrations (version, name) values ('%s', '%s');\n" "$version" "$name"
  } | psql -v ON_ERROR_STOP=1 --single-transaction -q -f -
  applied=$((applied + 1))
done

echo "Migrations complete ($applied applied)."

if [ "${APPLY_SEED:-false}" = "true" ]; then
  seeded=$(psql -tAc "select 1 from supabase_migrations.schema_migrations where version = 'seed'")
  if [ "$seeded" = "1" ]; then
    echo "Seed already applied, skipping."
  else
    echo "Applying supabase/seed.sql (dev/test data)..."
    {
      cat /seed.sql
      printf "\ninsert into supabase_migrations.schema_migrations (version, name) values ('seed', 'seed.sql');\n"
    } | psql -v ON_ERROR_STOP=1 --single-transaction -q -f -
    echo "Seed applied."
  fi
fi
