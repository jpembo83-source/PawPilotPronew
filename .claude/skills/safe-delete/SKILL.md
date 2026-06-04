---
name: safe-delete
description: >
  Proves a dependency, file, route, or symbol is unreferenced before it is removed from
  the PawPilotPro repo. This skill should be used whenever a task involves deleting an npm
  dependency, deleting or merging a file, removing a route, or removing an exported symbol
  — including the bloat-removal work (dead dependencies, duplicate files, debug routes).
  It runs a deterministic reference-counting script and refuses the deletion if anything
  still references the target.
---

# safe-delete — never remove anything without proof

The repo rule is: **no deletion without grep-proof of zero references.** This skill makes
that rule executable. Run it, paste the output into the PR, and only delete if it reports
zero references.

## Usage

```
/safe-delete <kind> <target>
```

- `kind` is one of: `dep` (npm package), `file` (path), `route` (route string/path), `symbol` (exported name).
- `target` is the package name, file path, route string, or symbol.

Run the bundled script, which searches the whole repo (excluding `node_modules`, build
output, and lockfiles) and exits non-zero if it finds any reference:

```bash
bash .claude/skills/safe-delete/scripts/dep-usage.sh <kind> <target>
```

## Procedure

1. Run the script for the target. Capture the full output.
2. **Zero references (exit 0):** the target is safe to remove. Proceed with the deletion,
   then re-run `build` + the smoke suite.
3. **Any references (exit 1):** do NOT delete. Report each reference. Decide per case:
   - genuinely used → keep it, close the task as "not dead".
   - used but replaceable (e.g. `uuid` → `crypto.randomUUID()`) → migrate the call sites
     first, then re-run safe-delete until it reports zero.
4. Always paste the final zero-reference output into the PR description as the proof.

## Notes specific to this repo

- For `dep` checks, the script looks for `import ... from 'pkg'`, `require('pkg')`, and
  bare/subpath specifiers. A package can also be pulled in transitively or by a build
  plugin — if the script reports zero but the build breaks, investigate before forcing it.
- For duplicate files (e.g. `info.ts` vs `info.tsx`), check which extension is actually
  imported before choosing which to keep.
- For routes, search both the server registration and any client navigation/links.
- This skill only proves references. It does not run the build — the gate (Spartan / CI)
  does that after the deletion.
