#!/usr/bin/env bash
# Keep Crunchadmin Next.js (:3000) + cloudflared quick tunnel alive.
# Writes the latest public URL to the Project store docs file.
set -u

APP_DIR="${APP_DIR:-/workspace/crunchadmin}"
TMUX_CONF="${TMUX_CONF:-/exec-daemon/tmux.portal.conf}"
URL_FILE="${URL_FILE:-/cursor/stores/self/docs/preview-url.md}"
LOCAL_URL="http://127.0.0.1:3000"
DEV_SESSION="crunchadmin-dev"
TUN_SESSION="crunchadmin-tunnel"
WATCH_SESSION="crunchadmin-watchdog"
INTERVAL_SECS="${INTERVAL_SECS:-20}"
LOG_FILE="${LOG_FILE:-/tmp/crunchadmin-watchdog.log}"

tmux_bin() {
  tmux -f "$TMUX_CONF" "$@"
}

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"
}

http_ok() {
  local url="$1"
  local code
  code=$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo 000)
  [[ "$code" == "200" ]]
}

ensure_session() {
  local name="$1"
  tmux_bin has-session -t "=$name" 2>/dev/null || \
    tmux_bin new-session -d -s "$name" -c "$APP_DIR" -- "${SHELL:-bash}" -l
}

start_next() {
  log "Starting Next.js on :3000"
  ensure_session "$DEV_SESSION"
  # Prefer production server (more stable than turbopack HMR for long demos)
  tmux_bin send-keys -t "$DEV_SESSION:0.0" C-c
  sleep 1
  tmux_bin send-keys -t "$DEV_SESSION:0.0" \
    "cd '$APP_DIR' && (test -d .next || npm run build) && npm run start -- --port 3000 --hostname 0.0.0.0" C-m
}

start_tunnel() {
  log "Starting cloudflared quick tunnel"
  ensure_session "$TUN_SESSION"
  tmux_bin send-keys -t "$TUN_SESSION:0.0" C-c
  sleep 1
  # Clear pane noise then launch
  tmux_bin send-keys -t "$TUN_SESSION:0.0" \
    "npx --yes cloudflared tunnel --url http://127.0.0.1:3000" C-m
}

extract_tunnel_url() {
  tmux_bin capture-pane -t "$TUN_SESSION:0.0" -p -J -S -400 2>/dev/null \
    | rg -o 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' \
    | head -1
}

write_url_file() {
  local url="$1"
  mkdir -p "$(dirname "$URL_FILE")"
  cat > "$URL_FILE" <<EOF
# Crunchadmin live preview

Updated: $(date -u +%Y-%m-%dT%H:%M:%SZ) UTC

## Public tunnel (current)

$url

- Home: $url/
- Pendientes: $url/pendientes

## Local

- http://127.0.0.1:3000/

## Watchdog

tmux session \`$WATCH_SESSION\` runs \`scripts/preview-watchdog.sh\`.
It restarts Next (\`npm run start\` on :3000) and cloudflared if health checks fail,
and rewrites this file whenever the trycloudflare hostname changes.

> Quick tunnels are ephemeral; the hostname changes on restart. Prefer a stable host (Vercel/etc.) when tokens are available.
EOF
}

ensure_next_healthy() {
  if http_ok "$LOCAL_URL/" && http_ok "$LOCAL_URL/pendientes"; then
    return 0
  fi
  log "Next unhealthy — restarting"
  # Kill stray next processes bound to 3000
  pkill -f 'next start|next-server|next dev' 2>/dev/null || true
  sleep 2
  start_next
  # Wait up to ~60s
  for _ in $(seq 1 30); do
    sleep 2
    if http_ok "$LOCAL_URL/"; then
      log "Next recovered"
      return 0
    fi
  done
  log "Next still down after restart"
  return 1
}

ensure_tunnel_healthy() {
  local url
  url=$(extract_tunnel_url)
  if [[ -n "$url" ]] && http_ok "$url/" && http_ok "$url/pendientes"; then
    write_url_file "$url"
    return 0
  fi
  log "Tunnel unhealthy (url='${url:-none}') — recreating"
  pkill -f 'cloudflared tunnel' 2>/dev/null || true
  sleep 2
  start_tunnel
  # Wait for URL + 200 (backoff for CF 429)
  local wait=8
  for attempt in $(seq 1 8); do
    sleep "$wait"
    url=$(extract_tunnel_url)
    if [[ -n "$url" ]] && http_ok "$url/"; then
      log "Tunnel recovered: $url"
      write_url_file "$url"
      return 0
    fi
    # If 429 / no URL, bump wait
    if [[ -z "$url" ]]; then
      log "No tunnel URL yet (attempt $attempt) — retry start"
      pkill -f 'cloudflared tunnel' 2>/dev/null || true
      sleep 2
      start_tunnel
      wait=$((wait + 6))
    fi
  done
  log "Tunnel still down"
  return 1
}

main() {
  log "Watchdog started (interval=${INTERVAL_SECS}s)"
  ensure_session "$DEV_SESSION"
  ensure_session "$TUN_SESSION"
  # Initial ensure
  ensure_next_healthy || true
  ensure_tunnel_healthy || true
  while true; do
    ensure_next_healthy || true
    ensure_tunnel_healthy || true
    sleep "$INTERVAL_SECS"
  done
}

main
