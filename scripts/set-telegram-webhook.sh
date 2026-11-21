#!/usr/bin/env bash
# Points the Telegram bot at your current tunnel URL.
# Usage:  ./scripts/set-telegram-webhook.sh https://something.trycloudflare.com
# Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from .env.local. Never prints them.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="${1:-}"
if [[ -z "$BASE" || ! "$BASE" =~ ^https:// ]]; then
  echo "Usage: $0 https://<your-tunnel>.trycloudflare.com"
  exit 1
fi
BASE="${BASE%/}"

set -a; source ./.env.local; set +a
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN missing in .env.local}"
: "${TELEGRAM_WEBHOOK_SECRET:?TELEGRAM_WEBHOOK_SECRET missing in .env.local}"

echo "Setting webhook to: $BASE/api/telegram/webhook"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${BASE}/api/telegram/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message","callback_query"]'
echo
echo "Check it: open http://localhost:3000/api/telegram/webhook-info"
