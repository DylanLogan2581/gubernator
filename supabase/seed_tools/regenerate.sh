#!/usr/bin/env bash
#
# Regenerates supabase/seed.sql for the Bovold Seed World.
#
# The committed seed.sql is a deterministic pg_dump of a single world that was
# advanced 32 turns through the real end-turn simulation. This script reproduces
# that world end to end so the seed can be rebuilt after schema or balance
# changes instead of being hand-edited.
#
# Flow:
#   1. build_world.sql  — wipe + author the turn-0 world: an Akaviri setting of
#                         4 nations and 36 settlements (the neutral human Free
#                         City of Bovold plus the Tsaesci, Tang Mo and Ka'Po'Tun),
#                         ~3,900 NPCs named from 4 culture namesets, spanning
#                         2-4 generations of family ties, full culture/
#                         religion/government/law/military/education/event data,
#                         a self-sufficient economy, deposits, managed populations
#                         and citizen assignments.
#   2. play             — advance 32 turns through the end-turn-simulation edge
#                         function, applying organic manager interventions
#                         (a drought, a summer-thaw blight, a longhouse fire, a
#                         ratified trade route and a serpent-isle war) so the
#                         history shows births, deaths and varying resource flows.
#   3. cleanup.sql      — tidy the turn-32 snapshot: full staffing across all six
#                         assignment types, the readiness matrix, active trade
#                         routes, restocked herds and topped-up survival stores.
#   4. dump + assemble  — strip the turn-current baseline snapshots (the baseline
#                         backfill below re-creates them), pg_dump the public
#                         tables and splice them, resources first, into seed.sql
#                         between the hand-authored auth block (auth_users.sql)
#                         and the baseline backfill (baseline.sql), wrapped in
#                         session_replication_role = replica.
#
# Requires a running local stack (`npx supabase start`) whose seeded auth users
# (superadmin@gubernator.local / password123 etc.) already exist — run
# `npx supabase db reset` once first. Then, from the repo root:
#
#   bash supabase/seed_tools/regenerate.sh
#
# followed by `npx supabase db reset && npx supabase test db` to verify.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
# Well-known local-dev anon key (shared JWT secret; matches integration tests).
ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
W=2edaa1c1-a2a3-cf6c-607b-0e30f63fdace
TURNS=32
export PGPASSWORD=postgres
q() { psql "$DB" -tAc "$1"; }

echo "[1/4] building the turn-0 world"
psql "$DB" --single-transaction -v ON_ERROR_STOP=1 -f "$HERE/build_world.sql" >/dev/null

echo "[2/4] playing $TURNS turns through the simulation"
TOKEN=$(curl -s "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
  -H 'content-type: application/json' \
  -d '{"email":"superadmin@gubernator.local","password":"password123"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
# Intervention targets, resolved by name/slug against the freshly built world
# (no hardcoded UUIDs — the builder generates deterministic real UUIDs).
FIELD=$(q "select id from public.job_definitions where world_id='$W' and slug='field-hand'")
WATER=$(q "select id from public.job_definitions where world_id='$W' and slug='water-bearer'")
S_DROUGHT=$(q "select id from public.settlements where name='Serpentreach'")
S_BLIGHT=$(q "select id from public.settlements where name='Tenth Isle'")
S_FIRE=$(q "select id from public.settlements where name='City of Bovold'")
ROUTE_RATIFY=$(q "select tr.id from public.trade_routes tr join public.settlements o on o.id=tr.origin_settlement_id where o.name='City of Bovold' and tr.status='proposed' limit 1")
LONGHOUSE_FIRE=$(q "select sb.id from public.settlement_buildings sb join public.settlements s on s.id=sb.settlement_id join public.building_blueprints bp on bp.id=sb.building_blueprint_id where s.name='City of Bovold' and bp.slug='longhouse' limit 1")
setstock() { q "update public.settlement_resource_stockpiles s set quantity=$3 from public.resources r where r.id=s.resource_id and r.world_id='$W' and r.slug='$2' and s.settlement_id='$1'" >/dev/null; }
fire() { q "delete from public.citizen_assignments a using public.citizens c where a.citizen_id=c.id and c.settlement_id='$1' and a.job_id='$2'" >/dev/null; }
rehire() { q "insert into public.citizen_assignments(citizen_id,assignment_type,job_id,assigned_on_turn_number) select c.id,'standard_job','$2',$3 from public.citizens c where c.settlement_id='$1' and c.citizen_type='npc' and c.status='alive' and c.born_on_turn_number<=-16 and c.id not in (select citizen_id from public.citizen_assignments) limit $4" >/dev/null; }

while :; do
  CUR=$(q "select current_turn_number from public.worlds where id='$W'")
  [ "$CUR" -ge "$TURNS" ] && break
  case "$CUR" in
    4)  setstock "$S_DROUGHT" fresh-water 16; fire "$S_DROUGHT" "$WATER"; echo "    t$CUR drought: Serpentreach cisterns run dry" ;;
    5)  rehire "$S_DROUGHT" "$WATER" "$CUR" 8; echo "    t$CUR Serpentreach cisterns reopened" ;;
    8)  q "update public.trade_routes set status='active',origin_approval_status='approved',destination_approval_status='approved',origin_approved_by_citizen_id=(select id from public.citizens where world_id='$W' and given_name='Aldous' and surname='Pennington' limit 1),destination_approved_by_citizen_id=(select id from public.citizens where world_id='$W' and given_name='Versidue' and surname='Shaie' limit 1) where id='$ROUTE_RATIFY'" >/dev/null; echo "    t$CUR Bovold->Xheenmar trade route ratified" ;;
    11) q "update public.nation_relationships set current_stance='at_war' where world_id='$W' and from_nation_id in (select id from public.nations where name in ('Tsaesciland Empire','Thousand Monkey Islands')) and to_nation_id in (select id from public.nations where name in ('Tsaesciland Empire','Thousand Monkey Islands'))" >/dev/null; echo "    t$CUR the serpents declare open war on the isles" ;;
    13) setstock "$S_BLIGHT" food 24; fire "$S_BLIGHT" "$FIELD"; echo "    t$CUR a summer thaw ruins the Tenth Isle fields" ;;
    14) rehire "$S_BLIGHT" "$FIELD" "$CUR" 6; echo "    t$CUR Tenth Isle fields replanted" ;;
    18) q "update public.settlement_buildings set state='suspended' where id='$LONGHOUSE_FIRE'" >/dev/null; echo "    t$CUR a longhouse fire leaves the City of Bovold overcrowded" ;;
    24) q "update public.settlement_buildings set state='active' where id='$LONGHOUSE_FIRE'" >/dev/null; echo "    t$CUR Bovold longhouse rebuilt" ;;
  esac
  # Local stack only: keep the per-minute limiter from stalling the 32-turn replay.
  q "delete from public.edge_rate_limit_buckets" >/dev/null
  curl -s "$API/functions/v1/end-turn-simulation" -H 'content-type: application/json' \
    -H "authorization: Bearer $TOKEN" \
    -d "{\"worldId\":\"$W\",\"expectedTurnNumber\":$CUR}" \
    | python3 -c '
import sys, json
d = json.load(sys.stdin)
if not d.get("ok"):
    print("ERR", json.dumps(d)[:300]); sys.exit(1)
s = d["data"]["summary"]
print("    turn %s->%s (births %s deaths %s)" % (s["fromTurnNumber"], s["toTurnNumber"], s["patchCounts"]["citizenBirths"], s["patchCounts"]["citizenDeaths"]))'
done

echo "[3/4] tidying the turn-$TURNS snapshot"
psql "$DB" -v ON_ERROR_STOP=1 -f "$HERE/cleanup.sql" >/dev/null

echo "[4/4] dumping and assembling seed.sql"
q "delete from public.settlement_turn_resource_snapshots where turn_transition_id is null; delete from public.settlement_turn_snapshots where turn_transition_id is null;"
# --load-via-partition-root folds rows from dynamically-named per-world
# partitions (turn_log_entries, settlement_turn_resource_snapshots) back
# under their root table name; a -t table filter list would miss those
# partitions entirely since their generated names don't match the filter.
pg_dump "$DB" --data-only --column-inserts --no-owner --no-privileges --no-comments --schema=public --load-via-partition-root > "$HERE/world_data.sql"

DATA="$HERE/world_data.sql" AUTH="$HERE/auth_users.sql" BASE="$HERE/baseline.sql" OUT="$ROOT/supabase/seed.sql" python3 - << 'PYEOF'
import os, re
order = ['worlds','resource_categories','resources','education_levels','job_definitions','deposit_types','deposit_type_jobs',
 'managed_population_types','managed_population_husbandry_jobs','managed_population_culling_jobs',
 'building_blueprints','building_blueprint_tiers','namesets','cultures','religions','nations',
 'nation_discoveries','settlements','citizens','nation_relationships','nation_treaties','nation_currencies','nation_currency_ledger_entries','partnerships',
 'office_types','nation_offices','government_bodies','law_documents','law_articles',
 'law_document_versions','law_amendments','law_amendment_votes','decrees',
 'settlement_resource_stockpiles','deposit_instances','deposit_instance_resources',
 'managed_population_instances','construction_projects','settlement_buildings','education_enrollments',
 'unit_types','armies','army_groups','army_units','unit_soldiers',
 'trade_routes','trade_route_legs','citizen_assignments','event_groups','events','event_effects',
 'citizen_memories','world_admins','user_active_player_characters','turn_transitions','turn_log_entries',
 'notifications','settlement_turn_snapshots','settlement_turn_resource_snapshots']
groups = {t: [] for t in order}
pat = re.compile(r'^INSERT INTO public\.(\w+) ')
for line in open(os.environ['DATA']):
    if line.startswith('INSERT INTO public.'):
        table = pat.match(line).group(1)
        # Full-schema dump (needed so --load-via-partition-root can fold
        # dynamically-named per-world partitions back to their root table)
        # picks up runtime-only tables outside `order` too; skip those.
        if table in groups:
            groups[table].append(line.rstrip('\n'))
hdr = ['', '-- ' + '=' * 73, '-- Bovold Seed World.', '--',
 '-- A single, richly populated Akaviri world (4 nations, 36 settlements, ~3,900',
 '-- citizens named from 4 culture namesets, with full culture/religion/government/',
 '-- law/military/education/event data and a self-sufficient economy) that was',
 '-- advanced 32 turns through the real end-turn simulation, then tidied into a',
 '-- clean, fully-managed turn-32 snapshot. Regenerate with supabase/seed_tools.',
 '--',
 '-- Generated pg_dump (--column-inserts) of the public application tables,',
 '-- loaded with triggers, RLS and FK checks disabled (session_replication_role',
 '-- = replica) so the rows load verbatim. Tables are emitted resources-first so',
 '-- the cross-table JSON CHECK validators (NOT disabled by replica mode) see',
 '-- their referenced resources/jobs. The turn-current baseline snapshots are',
 '-- created by the backfill block at the end. auth.users / public.users are',
 '-- handled above. Excluded from Prettier (see .prettierignore).',
 '-- ' + '=' * 73, 'set session_replication_role = replica;', '']
tail = list(hdr)
for t in order:
    if groups[t]:
        tail.append(f"-- {t} ({len(groups[t])} rows)")
        tail.extend(groups[t])
        tail.append("")
tail.append('set session_replication_role = default;')
auth = open(os.environ['AUTH']).read().rstrip('\n')
baseline = open(os.environ['BASE']).read().rstrip('\n')
open(os.environ['OUT'], 'w').write(auth + '\n' + '\n'.join(tail) + '\n' + baseline + '\n')
print('    wrote seed.sql:', sum(len(g) for g in groups.values()), 'data rows')
PYEOF

rm -f "$HERE/world_data.sql"
echo "done. Verify with: npx supabase db reset && npx supabase test db"
