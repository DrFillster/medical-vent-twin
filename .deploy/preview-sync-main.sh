#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/medical-vent-twin}"
cd "$REPO_DIR"

branch=$(git branch --show-current)
if [ "$branch" != "main" ]; then
  echo "preview-sync: refusing; checkout is on '$branch', not main" >&2
  exit 2
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "preview-sync: refusing; working tree is not clean" >&2
  exit 3
fi

git fetch --quiet origin main
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse origin/main)

if [ "$local_sha" = "$remote_sha" ]; then
  exit 0
fi

if git merge-base --is-ancestor "$local_sha" "$remote_sha"; then
  git merge --ff-only origin/main
  echo "preview-sync: fast-forwarded main to $remote_sha"
  exit 0
fi

echo "preview-sync: refusing; local main is not an ancestor of origin/main" >&2
exit 4
