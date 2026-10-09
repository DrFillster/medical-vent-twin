#!/bin/bash
set -eu

REPO="${1:-}"
if [ -z "$REPO" ]; then
  REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [ -z "$REPO" ] || [ ! -d "$REPO/.git" ]; then
  echo "medical-vent-twin repository path required" >&2
  exit 2
fi

cd "$REPO"

branch="$(git branch --show-current)"
if [ "$branch" != "main" ]; then
  echo "Refusing preview sync: deployment checkout is on '$branch', expected 'main'." >&2
  exit 3
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing preview sync: deployment checkout has local changes." >&2
  exit 4
fi

git fetch --quiet origin main
local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse origin/main)"

if [ "$local_sha" = "$remote_sha" ]; then
  exit 0
fi

git merge --ff-only origin/main

marker="ards-twin-v1.3-preview/web/DEPLOY_SOURCE_SHA.txt"
if [ -f "$marker" ]; then
  echo "Synced main to $(git rev-parse HEAD); v1.3 source $(tr -d '\r\n' < "$marker")"
else
  echo "Synced main to $(git rev-parse HEAD); preview source marker is absent."
fi
