#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/deploy-vm.sh <github-repository-url> [branch]"
  exit 1
fi

REPOSITORY_URL="$1"
BRANCH="${2:-main}"
APP_DIR="${APP_DIR:-/opt/apps/content-engine}"

sudo mkdir -p "$APP_DIR"
sudo chown "$(id -u):$(id -g)" "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPOSITORY_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin "$BRANCH" --tags
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f ".env" ]; then
  echo "Missing $APP_DIR/.env. Create it before starting the service."
  exit 1
fi

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:3000/health
