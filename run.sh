#!/usr/bin/env bash
# Trap production server + work loop (systemd-managed)
#
# Usage:
#   ./run.sh install     - install systemd user services (run once)
#   ./run.sh start       - start all services
#   ./run.sh stop        - stop all services
#   ./run.sh restart     - restart all services
#   ./run.sh status      - show service status
#   ./run.sh logs        - tail server logs (journald)
#   ./run.sh loop-logs   - tail work loop logs (journald)
#   ./run.sh bridge-logs - tail chat bridge logs (journald)

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3002}"
SYSTEMD_DIR="$HOME/.config/systemd/user"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

install_services() {
  echo -e "${GREEN}[trap] Installing systemd user services...${NC}"
  
  mkdir -p "$SYSTEMD_DIR"
  
  # Copy service files
  cp systemd/trap-server.service "$SYSTEMD_DIR/"
  cp systemd/trap-loop.service "$SYSTEMD_DIR/"
  cp systemd/trap-bridge.service "$SYSTEMD_DIR/"
  
  # Reload systemd
  systemctl --user daemon-reload
  
  echo -e "${GREEN}[trap] Services installed. Enable them to start on boot:${NC}"
  echo "  systemctl --user enable trap-server trap-loop trap-bridge"
  echo ""
  echo -e "${GREEN}[trap] Or use:${NC}"
  echo "  ./run.sh start --enable"
}

start_services() {
  local enable_flag="${1:-}"
  
  # Check if services are installed
  if [[ ! -f "$SYSTEMD_DIR/trap-server.service" ]]; then
    echo -e "${YELLOW}[trap] Services not installed. Installing first...${NC}"
    install_services
  fi
  
  echo -e "${GREEN}[trap] Starting services...${NC}"
  
  if [[ "$enable_flag" == "--enable" ]]; then
    systemctl --user enable --now trap-server trap-loop trap-bridge
    echo -e "${GREEN}[trap] Services started and enabled for boot${NC}"
  else
    systemctl --user start trap-server trap-loop trap-bridge
    echo -e "${GREEN}[trap] Services started${NC}"
  fi
  
  sleep 2
  status_services
}

stop_services() {
  echo -e "${YELLOW}[trap] Stopping services...${NC}"
  systemctl --user stop trap-loop trap-bridge trap-server 2>/dev/null || true
  echo -e "${GREEN}[trap] Services stopped${NC}"
}

restart_services() {
  echo -e "${GREEN}[trap] Restarting services...${NC}"
  systemctl --user restart trap-server trap-loop trap-bridge
  sleep 2
  status_services
}

status_services() {
  echo ""
  echo "=== Trap Service Status ==="
  echo ""
  
  local services=("trap-server" "trap-loop" "trap-bridge")
  local all_running=true
  
  for service in "${services[@]}"; do
    if systemctl --user is-active --quiet "$service" 2>/dev/null; then
      local status_color="$GREEN"
      local status_text="RUNNING"
    else
      local status_color="$RED"
      local status_text="STOPPED"
      all_running=false
    fi
    
    printf "${status_color}%-15s${NC} %s\n" "$service:" "$status_text"
    
    # Show additional info if running
    if systemctl --user is-active --quiet "$service" 2>/dev/null; then
      local pid
      pid=$(systemctl --user show -p MainPID --value "$service" 2>/dev/null || echo "?")
      local uptime
      uptime=$(systemctl --user show -p ActiveEnterTimestamp --value "$service" 2>/dev/null | cut -d' ' -f4- || echo "?")
      echo "  PID: $pid | Since: $uptime"
    fi
  done
  
  echo ""
  
  if $all_running; then
    echo -e "${GREEN}All services running${NC}"
  else
    echo -e "${YELLOW}Some services not running. Check logs with: ./run.sh logs${NC}"
  fi
}

show_logs() {
  local service="${1:-trap-server}"
  echo "Tailing logs for $service (Ctrl+C to exit)..."
  journalctl --user -u "$service" -f
}

show_all_logs() {
  echo "Tailing logs for all trap services (Ctrl+C to exit)..."
  journalctl --user -u trap-server -u trap-loop -u trap-bridge -f
}

clean_legacy() {
  # Kill any legacy background processes (from old run.sh versions)
  echo -e "${YELLOW}[trap] Cleaning up legacy processes...${NC}"
  
  local pids
  pids=$(ps aux | grep -E 'trap.*(loop|bridge|next|chat-bridge)' | grep -v grep | grep -v systemd | awk '{print $2}' || true)
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
    echo "$pids" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}[trap] Killed legacy processes: $pids${NC}"
  else
    echo -e "${GREEN}[trap] No legacy processes found${NC}"
  fi
  
  # Clean up old PID files
  rm -f /tmp/trap-*.pid /tmp/trap-*.log
}

# Legacy commands for backward compatibility
build() {
  echo -e "${GREEN}[trap] Building...${NC}"
  pnpm build 2>&1 | tail -5
  echo -e "${GREEN}[trap] Build complete${NC}"
}

# Migration helper
migrate() {
  echo -e "${YELLOW}[trap] Migrating from legacy run.sh to systemd...${NC}"
  clean_legacy
  install_services
  start_services --enable
  echo ""
  echo -e "${GREEN}[trap] Migration complete!${NC}"
  echo "Services are now managed by systemd and will survive gateway restarts."
}

# Main command handler
case "${1:-status}" in
  install)
    install_services
    ;;
  start)
    start_services "${2:-}"
    ;;
  stop)
    stop_services
    ;;
  restart)
    restart_services
    ;;
  status)
    status_services
    ;;
  logs|log)
    show_logs "trap-server"
    ;;
  loop-logs|loop-log)
    show_logs "trap-loop"
    ;;
  bridge-logs|bridge-log)
    show_logs "trap-bridge"
    ;;
  all-logs)
    show_all_logs
    ;;
  clean)
    clean_legacy
    ;;
  migrate)
    migrate
    ;;
  build)
    build
    ;;
  # Legacy aliases for compatibility
  watch)
    echo -e "${YELLOW}[trap] 'watch' mode deprecated. Use systemd timers or restart manually.${NC}"
    echo "To restart: ./run.sh restart"
    exit 1
    ;;
  loop-restart)
    systemctl --user restart trap-loop
    echo -e "${GREEN}[trap] Work loop restarted${NC}"
    ;;
  loop-stop)
    systemctl --user stop trap-loop
    echo -e "${GREEN}[trap] Work loop stopped${NC}"
    ;;
  *)
    echo "Usage: $0 {install|start|stop|restart|status|logs|loop-logs|bridge-logs|all-logs|migrate|clean|build}"
    echo ""
    echo "Commands:"
    echo "  install      - Install systemd user services"
    echo "  start        - Start all services"
    echo "  start --enable - Start and enable for boot"
    echo "  stop         - Stop all services"
    echo "  restart      - Restart all services"
    echo "  status       - Show service status"
    echo "  logs         - Tail server logs (journald)"
    echo "  loop-logs    - Tail work loop logs"
    echo "  bridge-logs  - Tail chat bridge logs"
    echo "  all-logs     - Tail all service logs"
    echo "  migrate      - Migrate from legacy run.sh to systemd"
    echo "  clean        - Clean up legacy processes"
    echo "  build        - Build the Next.js app"
    echo ""
    echo "Systemd commands (direct):"
    echo "  systemctl --user {start|stop|restart|status} trap-{server,loop,bridge}"
    echo "  journalctl --user -u trap-server -f"
    exit 1
    ;;
esac
