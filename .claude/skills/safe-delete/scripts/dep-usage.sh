#!/usr/bin/env bash
# safe-delete reference counter for the PawPilotPro repo.
# Proves whether a dependency / file / route / symbol is still referenced.
# Exit 0 = zero references (safe to delete). Exit 1 = references found (do NOT delete).
#
# Usage: dep-usage.sh <dep|file|route|symbol> <target>

set -euo pipefail

KIND="${1:-}"
TARGET="${2:-}"

if [[ -z "$KIND" || -z "$TARGET" ]]; then
  echo "usage: $0 <dep|file|route|symbol> <target>" >&2
  exit 2
fi

# Prefer ripgrep; fall back to grep -r. Always exclude noise.
EXCLUDES_RG=(--glob '!node_modules' --glob '!dist' --glob '!build' --glob '!.git'
             --glob '!*.lock' --glob '!package-lock.json' --glob '!pnpm-lock.yaml')
EXCLUDES_GREP=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build
               --exclude-dir=.git --exclude='*.lock' --exclude='package-lock.json'
               --exclude='pnpm-lock.yaml')

have_rg() { command -v rg >/dev/null 2>&1; }

search() {
  # $1 = extended regex pattern
  local pattern="$1"
  if have_rg; then
    rg --line-number --no-heading --color never "${EXCLUDES_RG[@]}" -e "$pattern" . || true
  else
    grep -rEn "${EXCLUDES_GREP[@]}" -e "$pattern" . || true
  fi
}

# Escape regex metacharacters in the target.
esc() { printf '%s' "$1" | sed -E 's/[][(){}.*+?^$|\\\/]/\\&/g'; }
T="$(esc "$TARGET")"

case "$KIND" in
  dep)
    # import x from 'pkg' | import 'pkg' | require('pkg') | from 'pkg/subpath'
    PATTERN="(from[[:space:]]+['\"]${T}(/[^'\"]*)?['\"]|require\(['\"]${T}(/[^'\"]*)?['\"]\)|import[[:space:]]+['\"]${T}(/[^'\"]*)?['\"])"
    ;;
  file)
    # references to the file by its basename (imports use relative paths, so the
    # repo-relative path won't match — the basename is the reliable signal)
    RAWBASE="$(printf '%s' "$TARGET" | sed -E 's/\.(ts|tsx|js|jsx)$//')"
    BN_ESC="$(esc "$(basename "$RAWBASE")")"
    PATTERN="(from[[:space:]]+|require\([[:space:]]*)['\"]([^'\"]*/)?${BN_ESC}(\.(ts|tsx|js|jsx))?['\"]"
    ;;
  route)
    # the route string as it appears in registration or navigation
    PATTERN="['\"]${T}['\"]"
    ;;
  symbol)
    # whole-word occurrences of the symbol name
    PATTERN="\\b${T}\\b"
    ;;
  *)
    echo "unknown kind: $KIND (expected dep|file|route|symbol)" >&2
    exit 2
    ;;
esac

echo "== safe-delete: searching for $KIND '$TARGET' =="
RESULTS="$(search "$PATTERN")"

if [[ -z "$RESULTS" ]]; then
  echo "RESULT: 0 references found — safe to delete."
  exit 0
else
  COUNT="$(printf '%s\n' "$RESULTS" | grep -c . || true)"
  echo "$RESULTS"
  echo "RESULT: $COUNT reference(s) found — DO NOT delete until these are removed."
  exit 1
fi
