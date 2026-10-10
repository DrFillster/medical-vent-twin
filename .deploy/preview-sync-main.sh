#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/medical-vent-twin}"
BRANCH="v1.3"
APP_DIR="$REPO_DIR/ards-twin-v1.0"
MARKER="$APP_DIR/web/DEPLOY_SOURCE_SHA.txt"

cd "$REPO_DIR"

branch=$(git branch --show-current)
if [ "$branch" != "$BRANCH" ]; then
  echo "v13-sync: refusing; checkout is on '$branch', not $BRANCH" >&2
  exit 2
fi

dirty=$(git status --porcelain | grep -v 'ards-twin-v1.0/web/DEPLOY_SOURCE_SHA.txt' || true)
if [ -n "$dirty" ]; then
  echo "v13-sync: refusing; working tree is not clean" >&2
  printf '%s\n' "$dirty" >&2
  exit 3
fi

git fetch --quiet origin "$BRANCH"
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse "origin/$BRANCH")
current_marker=""
if [ -f "$MARKER" ]; then
  current_marker=$(tr -d '\r\n' < "$MARKER")
fi

if [ "$local_sha" != "$remote_sha" ]; then
  if git merge-base --is-ancestor "$local_sha" "$remote_sha"; then
    git merge --ff-only "origin/$BRANCH"
    local_sha=$(git rev-parse HEAD)
  else
    echo "v13-sync: refusing; local $BRANCH is not an ancestor of origin/$BRANCH" >&2
    exit 4
  fi
fi

if [ "$current_marker" = "$local_sha" ]; then
  exit 0
fi

cd "$APP_DIR"
if [ ! -d node_modules ]; then
  npm ci
fi
npm run build
npm run verify:deploy
printf '%s\n' "$local_sha" > "$MARKER"
echo "v13-sync: validated and published $local_sha"
