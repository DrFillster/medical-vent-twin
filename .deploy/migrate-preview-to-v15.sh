#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/medical-vent-twin}"
TARGET_BRANCH="v1.5"

cd "$REPO_DIR"

dirty=$(git status --porcelain | grep -v 'ards-twin-v1.0/web/DEPLOY_SOURCE_SHA.txt' || true)
if [ -n "$dirty" ]; then
  echo "v15-migrate: refusing; working tree is not clean" >&2
  printf '%s\n' "$dirty" >&2
  exit 2
fi

git fetch --quiet origin "$TARGET_BRANCH"

if git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
  git checkout "$TARGET_BRANCH"
else
  git checkout -b "$TARGET_BRANCH" --track "origin/$TARGET_BRANCH"
fi

git merge --ff-only "origin/$TARGET_BRANCH"

cd "$REPO_DIR/ards-twin-v1.0"
if [ ! -d node_modules ]; then
  npm ci
fi
npm run build
npm run verify:deploy

cd "$REPO_DIR"
bash .deploy/install-preview-sync-launchd.sh

echo "v15-migrate: branch=$(git branch --show-current)"
echo "v15-migrate: sha=$(git rev-parse HEAD)"
echo "v15-migrate: origin=http://127.0.0.1:8770/"
