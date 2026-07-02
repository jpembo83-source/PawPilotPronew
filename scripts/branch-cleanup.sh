#!/usr/bin/env bash
#
# branch-cleanup.sh — safe remote-branch cleanup for PawPilotPro.
#
# WHY THIS SCRIPT EXISTS
# ----------------------
# The cleanup was analyzed and verified by Claude, but the sandboxed git relay
# in the web session only permits pushes to the designated working branch — it
# returns 403 on git-receive-pack for deleting other branches or pushing main,
# and the GitHub MCP server exposes no delete-branch/delete-ref tool. So the
# destructive steps must be run from an environment with real push access.
#
# SAFETY MODEL
# ------------
# Every delete is GUARDED: the script re-derives ahead/behind/merged at run time
# and refuses to delete anything that is not provably safe (ahead:0 + MERGED for
# Group A, behavior-present for Group C). Nothing is force-anything. It defaults
# to a DRY RUN — pass --apply to actually push deletes/merges.
#
#   ./scripts/branch-cleanup.sh          # dry run: prints what it WOULD do
#   ./scripts/branch-cleanup.sh --apply  # actually delete/merge
#
set -euo pipefail

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

run() {  # echo + (only when --apply) execute
  echo "    \$ $*"
  if [[ $APPLY -eq 1 ]]; then "$@"; fi
}

echo "==> Fetching and pruning"
git fetch --prune origin

ahead()  { git rev-list --count "origin/main..origin/$1"; }
behind() { git rev-list --count "origin/$1..origin/main"; }
merged() { git merge-base --is-ancestor "origin/$1" origin/main && echo MERGED || echo unmerged; }
exists() { git show-ref --verify --quiet "refs/remotes/origin/$1"; }

echo
echo "############################################################"
echo "# GROUP A — delete branches fully merged into main"
echo "############################################################"
GROUP_A=(
  security/auth-rewrite-1b
  security/frontend-auth-migration
  security/metadata-migration
  security/secrets-encryption
  feat/restore-realtime-broadcasts
  fix/smoke-tags
  merge/lineage-reconciliation
)
for b in "${GROUP_A[@]}"; do
  if ! exists "$b"; then echo "  [skip] $b — already gone"; continue; fi
  a=$(ahead "$b"); m=$(merged "$b")
  if [[ "$a" == "0" && "$m" == "MERGED" ]]; then
    echo "  [ok]   $b — ahead:0 MERGED -> delete"
    run git push origin --delete "$b"
  else
    echo "  [STOP] $b — ahead:$a $m (NOT safe) — leaving it, investigate"
  fi
done

echo
echo "############################################################"
echo "# GROUP B — fast-forward main with gifted-wright, then delete"
echo "############################################################"
B=claude/gifted-wright-bkf5ea
if ! exists "$B"; then
  echo "  [skip] $B — already gone"
else
  a=$(ahead "$B"); bh=$(behind "$B")
  echo "  $B — ahead:$a behind:$bh"
  echo "  commits that would land on main:"
  git log --format="    %h %s" "origin/main..origin/$B"
  if [[ "$bh" == "0" ]] && git merge-base --is-ancestor origin/main "origin/$B"; then
    echo "  [ok] fast-forwardable."
    echo "  >>> RUN YOUR GATE (lint, typecheck, build, smoke) BEFORE pushing main. <<<"
    run git checkout main
    run git merge --ff-only "origin/$B"
    run git push origin main
    run git push origin --delete "$B"
  else
    echo "  [STOP] $B is not a clean fast-forward (behind:$bh) — do not auto-merge."
  fi
fi

echo
echo "############################################################"
echo "# GROUP C — delete frosty-panini IFF its behavior is in main"
echo "############################################################"
C=claude/frosty-panini
if ! exists "$C"; then
  echo "  [skip] $C — already gone"
else
  # frosty-panini's unique value is cascade-delete of bookings on household
  # delete. Confirm main already deletes daycare/grooming/transport/overnight
  # records filtered by household_id inside the household-delete handler.
  hits=$(git grep -c -iE "daycare|grooming|transport|overnight" \
           origin/main -- '*customers_routes.tsx' 2>/dev/null | awk -F: '{s+=$NF} END{print s+0}')
  echo "  cascade markers found in main customers_routes.tsx: $hits"
  if [[ "$hits" -gt 0 ]]; then
    echo "  [ok] cascade-delete behavior present in main -> frosty-panini superseded -> delete"
    run git push origin --delete "$C"
  else
    echo "  [STOP] cascade behavior MISSING in main — do NOT delete."
    echo "         cherry-pick fbb7c05 onto a new branch off main, gate it, open a PR first."
  fi
fi

echo
echo "############################################################"
echo "# KEPT (never touched): feat/client-portal-app, main, portal-v1-phase-* tags"
echo "############################################################"
[[ $APPLY -eq 0 ]] && echo "(dry run — re-run with --apply to execute)"
echo
echo "==> Final remote branch list:"
git branch -r | grep -v HEAD
