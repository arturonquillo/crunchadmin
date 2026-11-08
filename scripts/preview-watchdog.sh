#!/usr/bin/env bash
# Keep Crunchadmin Next.js (:3000) alive for local/dev.
# Primary public URL is Hostinger. trycloudflare is optional/secondary only.
# Never promote trycloudflare over Hostinger in preview-url.md.
set -u

APP_DIR="${APP_DIR:-/agent/repos/crunchadmin}"
TMUX_CONF="${TMUX_CONF:-/exec-daemon/tmux.portal.conf}"
URL_FILE="${URL_FILE:-/cursor/stores/self/docs/preview-url.md}"
# Also keep the Project store path in sync when self is not the same inode.
URL_FILE_ALT="${URL_FILE_ALT:-/cursor/stores/bc-01a18574-4f7d-7f64-8704-0130cb2a34c2/docs/preview-url.md}"
PRIMARY_URL="${PRIMARY_URL:-https://test2.lecrunch.com.br}"
LOCAL_URL="http://127.0.0.1:3000"
DEV_SESSION="crunchadmin-dev"
TUN_SESSION="crunchadmin-tunnel"
WATCH_SESSION="crunchadmin-watchdog"
INTERVAL_SECS="${INTERVAL_SECS:-20}"
LOG_FILE="${LOG_FILE:-/tmp/crunchadmin-watchdog.log}"
# Optional: keep a local quick tunnel as backup. Default on for lab machines.
KEEP_TUNNEL="${KEEP_TUNNEL:-1}"

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
  tmux_bin send-keys -t "$DEV_SESSION:0.0" C-c
  sleep 1
  tmux_bin send-keys -t "$DEV_SESSION:0.0" \
    "cd '$APP_DIR' && (test -d .next || npm run build) && npm run start -- --port 3000 --hostname 0.0.0.0" C-m
}

start_tunnel() {
  log "Starting optional cloudflared quick tunnel (secondary)"
  ensure_session "$TUN_SESSION"
  tmux_bin send-keys -t "$TUN_SESSION:0.0" C-c
  sleep 1
  local cf_bin="${CLOUDFLARED_BIN:-}"
  if [[ -z "$cf_bin" ]]; then
    cf_bin=$(command -v cloudflared 2>/dev/null || true)
  fi
  if [[ -z "$cf_bin" ]]; then
    cf_bin=$(find /home/ubuntu/.npm/_npx -path '*/cloudflared/bin/cloudflared' -type f 2>/dev/null | head -1 || true)
  fi
  if [[ -z "$cf_bin" || ! -x "$cf_bin" ]]; then
    log "cloudflared binary not found — falling back to npx"
    tmux_bin send-keys -t "$TUN_SESSION:0.0" \
      "npx --yes cloudflared tunnel --url http://127.0.0.1:3000 --protocol http2 2>&1 | tee /tmp/crunchadmin-tunnel.log" C-m
  else
    log "Using cloudflared at $cf_bin"
    tmux_bin send-keys -t "$TUN_SESSION:0.0" \
      "'$cf_bin' tunnel --url http://127.0.0.1:3000 --protocol http2 2>&1 | tee /tmp/crunchadmin-tunnel.log" C-m
  fi
}

extract_tunnel_url() {
  local from_log from_pane
  from_log=$(rg -o 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' /tmp/crunchadmin-tunnel.log 2>/dev/null | tail -1 || true)
  if [[ -n "$from_log" ]]; then
    echo "$from_log"
    return 0
  fi
  from_pane=$(tmux_bin capture-pane -t "$TUN_SESSION:0.0" -p -J -S -400 2>/dev/null \
    | rg -o 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' \
    | tail -1 || true)
  echo "$from_pane"
}

write_url_file() {
  local secondary="${1:-}"
  local primary_ok="unknown"
  if http_ok "$PRIMARY_URL/"; then
    primary_ok="200"
  else
    primary_ok="down"
  fi

  local body
  body=$(cat <<EOF
# Crunchadmin live preview

Updated: $(date -u +%Y-%m-%dT%H:%M:%SZ) UTC

## Primary (Hostinger)

${PRIMARY_URL}

- Home: ${PRIMARY_URL}/
- Inventario: ${PRIMARY_URL}/inventario
- Producción: ${PRIMARY_URL}/produccion
- Recetas: ${PRIMARY_URL}/recetas
- Pendientes: ${PRIMARY_URL}/pendientes
- Chat: ${PRIMARY_URL}/chat

Status check: ${primary_ok}

## Secondary (optional trycloudflare)

EOF
)
  if [[ -n "$secondary" ]]; then
    body+=$(cat <<EOF

${secondary}

- Home: ${secondary}/
- Inventario: ${secondary}/inventario

> Lab/dev fallback only. Do not treat this as the owner-facing URL.
EOF
)
  else
    body+=$'\n_(none / not required)_\n'
  fi

  body+=$(cat <<EOF

## Local

- http://127.0.0.1:3000/

## Watchdog

tmux session \`$WATCH_SESSION\` runs \`scripts/preview-watchdog.sh\`.
Primary URL is always Hostinger (\`$PRIMARY_URL\`). trycloudflare is optional secondary only.
EOF
)

  mkdir -p "$(dirname "$URL_FILE")"
  printf '%s\n' "$body" > "$URL_FILE"
  if [[ -n "$URL_FILE_ALT" && "$URL_FILE_ALT" != "$URL_FILE" ]]; then
    # If self is a symlink into the project store, this is a no-op overwrite of the same file.
    mkdir -p "$(dirname "$URL_FILE_ALT")"
    if [[ ! -e "$URL_FILE_ALT" ]] || ! cmp -s "$URL_FILE" "$URL_FILE_ALT" 2>/dev/null; then
      # Only write alt when distinct path content differs; avoid fighting symlinks.
      if [[ "$(readlink -f "$URL_FILE" 2>/dev/null || echo "$URL_FILE")" != "$(readlink -f "$URL_FILE_ALT" 2>/dev/null || echo "$URL_FILE_ALT")" ]]; then
        printf '%s\n' "$body" > "$URL_FILE_ALT"
      fi
    fi
  fi
}

ensure_next_healthy() {
  if http_ok "$LOCAL_URL/" && http_ok "$LOCAL_URL/inventario"; then
    return 0
  fi
  log "Next unhealthy — restarting"
  pkill -f 'next start|next-server|next dev' 2>/dev/null || true
  sleep 2
  start_next
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

ensure_tunnel_optional() {
  local url=""
  if [[ "$KEEP_TUNNEL" != "1" ]]; then
    write_url_file ""
    return 0
  fi

  url=$(extract_tunnel_url)
  if [[ -n "$url" ]] && http_ok "$url/"; then
    write_url_file "$url"
    return 0
  fi

  log "Optional tunnel unhealthy (url='${url:-none}') — recreating"
  pkill -f 'cloudflared tunnel' 2>/dev/null || true
  sleep 2
  start_tunnel
  local wait=8
  for attempt in $(seq 1 6); do
    sleep "$wait"
    url=$(extract_tunnel_url)
    if [[ -n "$url" ]] && http_ok "$url/"; then
      log "Optional tunnel recovered: $url"
      write_url_file "$url"
      return 0
    fi
    if [[ -z "$url" ]]; then
      log "No tunnel URL yet (attempt $attempt)"
      pkill -f 'cloudflared tunnel' 2>/dev/null || true
      sleep 2
      start_tunnel
      wait=$((wait + 6))
    fi
  done
  log "Optional tunnel still down — keeping Hostinger primary in docs"
  write_url_file ""
  return 0
}

main() {
  log "Watchdog started (interval=${INTERVAL_SECS}s) primary=$PRIMARY_URL"
  ensure_session "$DEV_SESSION"
  if [[ "$KEEP_TUNNEL" == "1" ]]; then
    ensure_session "$TUN_SESSION"
  fi
  ensure_next_healthy || true
  ensure_tunnel_optional || true
  while true; do
    ensure_next_healthy || true
    ensure_tunnel_optional || true
    sleep "$INTERVAL_SECS"
  done
}

main
