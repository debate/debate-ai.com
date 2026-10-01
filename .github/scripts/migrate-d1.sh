#!/usr/bin/env bash
#
# Operator wrapper around .github/scripts/migrate-d1.ts for interactive shells.
#
# The Bun runner shells out to a bare `wrangler`, so it needs two things that
# `bun run db:migrate:d1` does not supply outside CI: wrangler on PATH (it lives
# in the app's node_modules/.bin, not the root's) and a CLOUDFLARE_API_TOKEN,
# which wrangler refuses to prompt for in a non-interactive process.
#
# The token is never written to disk by this script. It is read from, in order:
#
#   1. $CLOUDFLARE_API_TOKEN already in the environment
#   2. .env.d1.local at the repo root (gitignored — safe to put a token there)
#   3. an interactive hidden prompt
#
# Usage:
#   .github/scripts/migrate-d1.sh --dry-run     list pending, apply nothing
#   .github/scripts/migrate-d1.sh               apply pending, after confirming
#   .github/scripts/migrate-d1.sh --local       target the local D1 instead
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_ROOT="$REPO_ROOT/apps/debate-ai.com"
ENV_FILE="$REPO_ROOT/.env.d1.local"

if [ ! -d "$APP_ROOT" ]; then
  echo "Cannot find $APP_ROOT" >&2
  exit 1
fi

export PATH="$APP_ROOT/node_modules/.bin:$PATH"
if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler not found at $APP_ROOT/node_modules/.bin — run 'bun install' in $APP_ROOT" >&2
  exit 1
fi

# Only read the token out of the env file; do not source it, so an unrelated
# line in that file cannot alter PATH or the shell's options.
read_token_from_file() {
  [ -f "$ENV_FILE" ] || return 1
  sed -n 's/^[[:space:]]*CLOUDFLARE_API_TOKEN[[:space:]]*=[[:space:]]*//p' "$ENV_FILE" \
    | tail -n 1 \
    | sed "s/^[\"']//; s/[\"']$//"
}

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  CLOUDFLARE_API_TOKEN="$(read_token_from_file || true)"
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  if [ ! -t 0 ]; then
    echo "No CLOUDFLARE_API_TOKEN in the environment or $ENV_FILE, and stdin is not a terminal." >&2
    echo "Create one with D1 edit access: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/" >&2
    exit 1
  fi
  read -r -s -p "Cloudflare API token (D1 edit): " CLOUDFLARE_API_TOKEN
  echo
  [ -n "$CLOUDFLARE_API_TOKEN" ] || { echo "Empty token." >&2; exit 1; }
fi

export CLOUDFLARE_API_TOKEN

cd "$APP_ROOT"
exec bun "$REPO_ROOT/.github/scripts/migrate-d1.ts" "$@"
