#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/medical-vent-twin}"
BRANCH="v1.5"
WEB_DIR="$REPO_DIR/ards-twin-v1.0/web"
MARKER="$WEB_DIR/DEPLOY_SOURCE_SHA.txt"

cd "$REPO_DIR"

branch=$(git branch --show-current)
if [ "$branch" != "$BRANCH" ]; then
  echo "v15-sync: refusing; checkout is on '$branch', not $BRANCH" >&2
  exit 2
fi

# Production serves a pre-built, CI-validated artifact. Never rebuild the
# physiology or presentation on the production Mac.
dirty_outside_web=$(git status --porcelain | awk '{print $2}' | grep -Ev '^ards-twin-v1\.0/web/' || true)
if [ -n "$dirty_outside_web" ]; then
  echo "v15-sync: refusing; working tree has changes outside served web artifact" >&2
  printf '%s\n' "$dirty_outside_web" >&2
  exit 3
fi

git fetch --quiet origin "$BRANCH"
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse "origin/$BRANCH")

if [ "$local_sha" != "$remote_sha" ]; then
  if git merge-base --is-ancestor "$local_sha" "$remote_sha"; then
    git merge --ff-only "origin/$BRANCH"
    local_sha=$(git rev-parse HEAD)
  else
    echo "v15-sync: refusing; local $BRANCH is not an ancestor of origin/$BRANCH" >&2
    exit 4
  fi
fi

# A legacy sync invocation may have regenerated tracked web assets before this
# script revision was pulled. Restore the exact validated artifact from HEAD.
git restore --source=HEAD --worktree -- ards-twin-v1.0/web

test -f "$WEB_DIR/index.html"
test -f "$WEB_DIR/app.js"
test -f "$WEB_DIR/engine.js"
test -f "$MARKER"
grep -q 'id="clinical-speed"' "$WEB_DIR/index.html"
grep -q 'v2.4.1-physiology-triggered-terminal-state' "$WEB_DIR/engine.js"
grep -q 'asphyxial-hemodynamic-collapse-envelope' "$WEB_DIR/engine.js"

source_sha=$(tr -d '\r\n' < "$MARKER")
case "$source_sha" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*)
    ;;
  *)
    echo "v15-sync: invalid deployment source marker '$source_sha'" >&2
    exit 5
    ;;
esac

echo "v15-sync: serving validated artifact source=$source_sha branch_commit=$local_sha"
