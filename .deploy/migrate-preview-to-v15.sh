#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/medical-vent-twin}"
TARGET_BRANCH="v1.5"
WEB_REL="ards-twin-v1.0/web"
BACKUP_ROOT="${BACKUP_ROOT:-$REPO_DIR/.deploy/backups}"
INSTALL_SERVICES="${MIGRATE_INSTALL_SERVICES:-1}"

cd "$REPO_DIR"

current_branch="$(git branch --show-current)"
current_sha="$(git rev-parse HEAD)"
status_file="$(mktemp)"
trap 'rm -f "$status_file"' EXIT

git status --porcelain --untracked-files=all > "$status_file"

outside_dirty=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  path="${line#???}"
  case "$path" in
    "$WEB_REL"|"$WEB_REL"/*) ;;
    *) outside_dirty="$outside_dirty$line
" ;;
  esac
done < "$status_file"

if [ -n "$outside_dirty" ]; then
  echo "v15-migrate: refusing; changes exist outside $WEB_REL" >&2
  printf '%s' "$outside_dirty" >&2
  exit 2
fi

if [ -s "$status_file" ]; then
  stamp="$(date '+%Y%m%d-%H%M%S')"
  backup="$BACKUP_ROOT/v15-migration-$stamp"
  mkdir -p "$backup"
  cp -R "$WEB_REL" "$backup/web"
  git diff -- "$WEB_REL" > "$backup/tracked-web.diff" || true
  cp "$status_file" "$backup/git-status.txt"
  printf '%s\n' "$current_branch" > "$backup/pre-migration-branch.txt"
  printf '%s\n' "$current_sha" > "$backup/pre-migration-sha.txt"
  echo "v15-migrate: backed up current public web directory to $backup"

  git checkout -- "$WEB_REL"
  git clean -fd -- "$WEB_REL"
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
published_sha="$(git rev-parse HEAD)"
printf '%s\n' "$published_sha" > "$WEB_REL/DEPLOY_SOURCE_SHA.txt"

if [ "$INSTALL_SERVICES" = "1" ]; then
  bash .deploy/install-preview-sync-launchd.sh

  local_ok=0
  for attempt in $(seq 1 20); do
    index_code=$(curl -L -sS -o /tmp/v15-origin-index.html -w '%{http_code}' --max-time 5 http://127.0.0.1:8770/ || printf '000')
    source_code=$(curl -L -sS -o /tmp/v15-origin-source.txt -w '%{http_code}' --max-time 5 http://127.0.0.1:8770/DEPLOY_SOURCE_SHA.txt || printf '000')
    live_sha=$(tr -d '\r\n' < /tmp/v15-origin-source.txt 2>/dev/null || true)
    if [ "$index_code" = "200" ] && [ "$source_code" = "200" ] && [ "$live_sha" = "$published_sha" ] && grep -q "Live model vs candidate model" /tmp/v15-origin-index.html; then
      local_ok=1
      break
    fi
    sleep 1
  done
  rm -f /tmp/v15-origin-index.html /tmp/v15-origin-source.txt
  if [ "$local_ok" != "1" ]; then
    echo "v15-migrate: local origin did not verify expected physician-preview content at $published_sha" >&2
    exit 5
  fi
else
  echo "v15-migrate: service installation skipped by MIGRATE_INSTALL_SERVICES=$INSTALL_SERVICES"
fi

echo "v15-migrate: branch=$(git branch --show-current)"
echo "v15-migrate: sha=$published_sha"
echo "v15-migrate: local-origin-verified=$INSTALL_SERVICES"
echo "v15-migrate: origin=http://127.0.0.1:8770/"
