#!/usr/bin/env bash
# Rejoue les migrations sur une base jetable puis exécute les tests SQL.
# Usage : PGUSER=postgres bash supabase/tests/run.sh   (Postgres local requis)
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-community_safe_test}"
PSQL="${PSQL:-psql -X -q -v ON_ERROR_STOP=1}"
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -d "$DB" -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do $PSQL -d "$DB" -f "$f"; done
$PSQL -d "$DB" -f tests/10_flows.test.sql
echo "✔ tests base de données OK"
