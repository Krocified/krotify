#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/server"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${API_TOKEN:?Set API_TOKEN in server/.env or the environment}"
export API_TOKEN
export PORT="${PORT:-3000}"

export TMPDIR="$PWD/.tmp"
export XDG_CACHE_HOME="$PWD/.cache"
export npm_config_cache="$PWD/.npm-cache"
mkdir -p "$TMPDIR" "$XDG_CACHE_HOME" "$npm_config_cache"

if [ -z "${YTDLP_PATH:-}" ]; then
  for candidate in "./bin/yt-dlp" "$(command -v yt-dlp 2>/dev/null || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      YTDLP_PATH="$candidate"
      break
    fi
  done
fi

if [ -z "${YTDLP_PATH:-}" ]; then
  echo "yt-dlp not found. Set YTDLP_PATH or install it:" >&2
  echo "  https://github.com/yt-dlp/yt-dlp/releases" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install it first." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing server dependencies..."
  npm install --omit=dev
fi

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "krotify link service"
if [ -n "$LAN_IP" ]; then
  echo "  url:   http://$LAN_IP:$PORT"
fi
echo "  token: ${API_TOKEN:0:3}***"
echo

exec node src/index.js
