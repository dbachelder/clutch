#!/usr/bin/env bash
# Trap production server with auto-rebuild on file changes
# Usage: ./run.sh [build|start|watch|dev]
#   build - one-shot build
#   start - start production server (no file watching)
#   watch - build + start + rebuild on main branch changes
#   dev   - same as old pnpm dev (for when you need HMR)

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3002}"
LOG="/tmp/trap-prod.log"
PID_FILE="/tmp/trap-prod.pid"

build() {
  echo "[trap] Building..."
  pnpm build 2>&1 | tail -5
  echo "[trap] Build complete"
}

start_server() {
  stop_server 2>/dev/null || true
  echo "[trap] Starting production server on port $PORT"
  NODE_ENV=production nohup volta run node ./node_modules/next/dist/bin/next start -p "$PORT" > "$LOG" 2>&1 &
  echo $! > "$PID_FILE"
  echo "[trap] PID $(cat "$PID_FILE"), log: $LOG"
}

stop_server() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      wait "$pid" 2>/dev/null || true
      echo "[trap] Stopped PID $pid"
    fi
    rm -f "$PID_FILE"
  fi
  # Also kill any lingering next start processes on our port
  pkill -f "next start.*$PORT" 2>/dev/null || true
}

rebuild_and_restart() {
  echo "[trap] Detected changes, rebuilding..."
  build
  start_server
  echo "[trap] Restarted at $(date '+%H:%M:%S')"
}

watch_and_rebuild() {
  build
  start_server

  echo "[trap] Watching for git changes on main..."
  local last_hash
  last_hash=$(git rev-parse HEAD)

  while true; do
    sleep 10
    # Pull latest (fast-forward only, no prompt)
    git fetch origin main --quiet 2>/dev/null || true
    local remote_hash
    remote_hash=$(git rev-parse origin/main 2>/dev/null || echo "$last_hash")

    if [[ "$remote_hash" != "$last_hash" ]]; then
      echo "[trap] main updated: ${last_hash:0:7} → ${remote_hash:0:7}"
      git pull --ff-only --quiet 2>/dev/null || {
        echo "[trap] Pull failed (dirty state?), skipping"
        continue
      }
      last_hash="$remote_hash"
      rebuild_and_restart
    fi
  done
}

case "${1:-watch}" in
  build)
    build
    ;;
  start)
    build
    start_server
    ;;
  stop)
    stop_server
    ;;
  watch)
    trap 'stop_server; exit 0' INT TERM
    watch_and_rebuild
    ;;
  dev)
    exec pnpm dev
    ;;
  log|logs)
    tail -f "$LOG"
    ;;
  *)
    echo "Usage: $0 [build|start|stop|watch|dev|logs]"
    exit 1
    ;;
esac
