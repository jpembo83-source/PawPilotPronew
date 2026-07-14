# scripts/pipeline — dev replica & promotion helpers

Tooling for the dev→prod pipeline. Full flow: [`deploy-workflow/RUNBOOK.md`](../../deploy-workflow/RUNBOOK.md).

## ⛔ Golden rule: raw prod PII never leaves prod unsanitised

Real customer emails, phones, names, addresses, and notes **must never be
committed to the repo or loaded into staging/local**. The only route prod data
takes anywhere is through `sanitise-dump.mjs`. Raw dumps are shredded in the same
step that produces them and are `.gitignore`d (`*.raw.sql`, `*.sanitised.sql`,
`prod-data*.sql`).

## Files

| File | What it does |
|---|---|
| `sanitise-dump.mjs` | Reads a `supabase db dump --data-only --use-copy` dump on stdin/`--in`, rewrites all PII, writes a PII-free dump. Fails closed on INSERT-format dumps, unclassified PII-looking columns, or any surviving real email. |
| `dev-local.sh` | `supabase start` + load a sanitised prod-shaped dataset locally (`--from-prod` / `--raw` / `--dump`). |
| `__fixtures__/sample-prod-data.sql` | Synthetic (fake) COPY-format dump used to test the sanitiser. |

## What gets scrubbed

Emails → `user+{id}@example.test`, phones → a fixed fake, names → `Test {n}`,
free-text notes/medical/behaviour/allergies/reasons → `REDACTED`, addresses →
a fake address, microchips → a fixed fake — across the relational app tables
**and** inside `kv_store_fc003b23` JSONB values. The authoritative allow/deny
**field list** is `TABLE_RULES` at the top of `sanitise-dump.mjs`.

**When you add a PII-bearing column or table**, add a rule (or mark it `safe`) in
`TABLE_RULES`. The sanitiser aborts on any PII-looking column it doesn't
recognise, so replication will refuse to run until it's classified.

## Test the sanitiser

```bash
node scripts/pipeline/sanitise-dump.mjs < scripts/pipeline/__fixtures__/sample-prod-data.sql
# stderr shows a per-table kept/dropped report; stdout is the sanitised dump.
```
