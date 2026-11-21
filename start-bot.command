#!/bin/bash
# Double-click this file to bring the Nagrik Telegram bot online:
# starts the dev server (if needed), opens a Cloudflare tunnel, and points Telegram at it.
# Keep this window open while you use the bot. Close it to stop the tunnel.

cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

say() { printf "\n\033[1m%s\033[0m\n" "$1"; }

if ! command -v cloudflared >/dev/null 2>&1; then
  say "cloudflared is not installed."
  echo "Install it with:  brew install cloudflared"
  echo "Then double-click this file again."
  read -r -p "Press Enter to close."
  exit 1
fi

# 1. Dev server
if curl -s -o /dev/null -m 3 http://localhost:3000/api/telegram/webhook; then
  say "Dev server is already running on localhost:3000."
else
  say "Starting the dev server (npm run dev)..."
  npm run dev > .dev-server.log 2>&1 &
  DEV_PID=$!
  for i in $(seq 1 60); do
    curl -s -o /dev/null -m 2 http://localhost:3000/api/telegram/webhook && break
    sleep 1
  done
  if ! curl -s -o /dev/null -m 3 http://localhost:3000/api/telegram/webhook; then
    say "The dev server didn't start. See .dev-server.log in this folder."
    read -r -p "Press Enter to close."
    exit 1
  fi
  echo "Dev server is up."
fi

# 2. Tunnel
say "Opening a Cloudflare tunnel..."
: > .tunnel.log
cloudflared tunnel --no-autoupdate --url http://localhost:3000 > .tunnel.log 2>&1 &
CF_PID=$!
cleanup() {
  kill "$CF_PID" 2>/dev/null
  [ -n "$DEV_PID" ] && kill "$DEV_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

URL=""
for i in $(seq 1 45); do
  URL=$(grep -oE 'https://[-a-z0-9]+\.trycloudflare\.com' .tunnel.log | head -1)
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then
  say "Couldn't get a tunnel address. Last lines of .tunnel.log:"
  tail -n 15 .tunnel.log
  read -r -p "Press Enter to close."
  exit 1
fi
echo "Tunnel address: $URL"

# Give the new address a moment to become reachable.
for i in $(seq 1 20); do
  curl -s -o /dev/null -m 4 "$URL/api/telegram/webhook" && break
  sleep 1
done

# 3. Point Telegram at it
say "Connecting the Telegram bot..."
./scripts/set-telegram-webhook.sh "$URL"

say "Bot is online. Keep this window open while you use it."
echo "Status page: http://localhost:3000/api/telegram/webhook-info"
echo "Close this window (or press Ctrl+C) to stop the tunnel."
wait "$CF_PID"
