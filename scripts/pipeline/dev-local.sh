#!/usr/bin/env bash
# PawPilotPro — spin up a prod-SHAPED local dev DB in one command.
#
# Runs `supabase start` (which applies the migrations) and, optionally, loads a
# PII-SANITISED copy of prod data so local looks like production without ever
# touching real personal data.
#
# RAW PROD PII MUST NEVER BE COMMITTED OR LOADED UNSANITISED. Every path here
# routes prod data through scripts/pipeline/sanitise-dump.mjs and shreds the raw
# dump; the sanitised file is written to a temp dir, never into the repo.
#
# Usage:
#   scripts/pipeline/dev-local.sh                 # start local, migrations only (empty app data)
#   scripts/pipeline/dev-local.sh --from-prod     # dump prod -> sanitise -> load (needs SUPABASE_PROD_DB_URL)
#   scripts/pipeline/dev-local.sh --raw dump.sql  # sanitise a raw dump you already made, then load
#   scripts/pipeline/dev-local.sh --dump clean.sql# load an ALREADY-sanitised dump
#
set -euo pipefail

MODE="none"; SRC=""
while [ $# -gt 0 ]; do
  case "$1" in
    --from-prod) MODE="from-prod";;
    --raw)  MODE="raw";  SRC="${2:-}"; shift;;
    --dump) MODE="dump"; SRC="${2:-}"; shift;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
  shift
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="$ROOT/PawPilotPro/project"
SANITISER="$ROOT/scripts/pipeline/sanitise-dump.mjs"
APP_TABLES="pet_updates customer_activities household_flags household_notes note_pets customer_documents pets contacts households kv_store_fc003b23"

command -v supabase >/dev/null || { echo "supabase CLI not found. https://supabase.com/docs/guides/local-development" >&2; exit 1; }

echo "==> Starting local Supabase stack (applies migrations)…"
( cd "$PROJECT" && supabase start )

# Resolve the local DB URL from the running stack (fall back to the CLI default).
LOCAL_DB_URL="$(cd "$PROJECT" && supabase status -o env 2>/dev/null | sed -n 's/^DB_URL=//p' | tr -d '"' || true)"
LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [ "$MODE" = "none" ]; then
  echo "==> Local stack up (migrations only). App tables are empty."
  echo "    Local DB: $LOCAL_DB_URL"
  echo "    To load prod-shaped data:  $0 --from-prod"
  exit 0
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
CLEAN="$TMP/prod-data.sanitised.sql"

case "$MODE" in
  from-prod)
    : "${SUPABASE_PROD_DB_URL:?Set SUPABASE_PROD_DB_URL (prod pooler connection string) to pull from prod}"
    echo "==> Dumping prod DATA (public schema, read-only)…"
    # --use-copy forces COPY (text) format, required by the sanitiser.
    supabase db dump --db-url "$SUPABASE_PROD_DB_URL" --data-only --use-copy --schema public -f "$TMP/raw.sql"
    echo "==> Sanitising…"
    node "$SANITISER" --in "$TMP/raw.sql" --out "$CLEAN"
    shred -u "$TMP/raw.sql" 2>/dev/null || rm -f "$TMP/raw.sql"
    ;;
  raw)
    [ -f "$SRC" ] || { echo "raw dump not found: $SRC" >&2; exit 1; }
    echo "==> Sanitising $SRC…"
    node "$SANITISER" --in "$SRC" --out "$CLEAN"
    echo "    (Reminder: delete your raw dump $SRC — it contains real PII.)"
    ;;
  dump)
    [ -f "$SRC" ] || { echo "dump not found: $SRC" >&2; exit 1; }
    echo "==> Using pre-sanitised dump $SRC (assuming it was produced by the sanitiser)."
    cp "$SRC" "$CLEAN"
    ;;
esac

echo "==> Resetting local app tables…"
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY string_to_array('$APP_TABLES', ' ')
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('TRUNCATE public.%I RESTART IDENTITY CASCADE', t);
    END IF;
  END LOOP;
END \$\$;
SQL

echo "==> Loading sanitised data…"
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" -f "$CLEAN"

echo "==> Row counts:"
for t in $APP_TABLES; do
  n="$(psql "$LOCAL_DB_URL" -tAc "SELECT count(*) FROM public.$t" 2>/dev/null || echo 'n/a')"
  printf '    %-24s %s\n' "$t" "$n"
done
echo "==> Done. Prod-shaped, PII-free local DB is ready at $LOCAL_DB_URL"
