#!/usr/bin/env bash
set -euo pipefail

# Script to start backend and frontend in "production" locally on ports using PM2
# Backend: 4010
# Frontend: 4011
# It will kill any process listening on those ports, build both apps, then start them with PM2.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ports=(4010 4011)

# Check if PM2 is installed
if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ PM2 is not installed. Installing globally..."
  npm install -g pm2 || pnpm add -g pm2
fi

get_pids_for_port() {
  local port="$1"
  local list=""
  if command -v lsof >/dev/null 2>&1; then
    list+="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)\n"
  fi
  if command -v ss >/dev/null 2>&1; then
    # Escape inner quotes to avoid breaking the parent double-quoted string
    list+="$(ss -ltnp 2>/dev/null | awk -v p=\":$port\" '$4 ~ p || $5 ~ p {for(i=1;i<=NF;i++) if($i ~ /pid=/){ if(match($i, /pid=([0-9]+)/, m)) print m[1] }}' || true)\n"
  fi
  if command -v netstat >/dev/null 2>&1; then
    list+="$(netstat -ltnp 2>/dev/null | awk -v p=\":$port\" '$4 ~ p { if(match($7, /^([0-9]+)/, m)) print m[1] }' || true)\n"
  fi

  echo -e "$list" | tr ' ' '\n' | sed '/^$/d' | sort -n -u || true
}

# Create logs directory early so redirects don't fail
mkdir -p logs || true

# Prevent unbounded log growth from PM2-managed log files.
if [ -x "${ROOT_DIR}/scripts/setup-pm2-logrotate.sh" ]; then
  "${ROOT_DIR}/scripts/setup-pm2-logrotate.sh" || true
fi

# Stop and delete existing PM2 processes to avoid conflicts
echo "Cleaning up existing PM2 processes..."
pm2 delete backend 2>/dev/null || true
pm2 delete frontend 2>/dev/null || true
sleep 1

# Check that a process is listening on a TCP port (retries)
check_port() {
  local port="$1"
  local retries=${2:-10}
  local i=0
  while [ "$i" -lt "$retries" ]; do
    if ss -ltnp 2>/dev/null | egrep -q ":${port}\\b"; then
      return 0
    fi
    sleep 0.5
    i=$((i+1))
  done
  return 1
}

# Show last lines of a log (for debugging)
show_log_tail() {
  local file="$1"
  echo "==== Last 200 lines of ${file} ===="
  tail -n 200 "${file}" 2>/dev/null || true
}

echo "Checking production ports: ${ports[*]}"
found_any=0
for port in "${ports[@]}"; do
  pids=$(get_pids_for_port "$port")
  if [ -n "$pids" ]; then
    found_any=1
    echo "Port $port in use by PID(s):"
    echo "$pids"
    for pid in $pids; do
      echo "Sending SIGTERM to PID $pid..."
      kill "$pid" || echo "Failed to send SIGTERM to $pid"
    done
  else
    echo "Port $port free."
  fi
done

if [ "$found_any" -eq 1 ]; then
  echo "Waiting 2 seconds for processes to exit..."
  sleep 2
  for port in "${ports[@]}"; do
    pids=$(get_pids_for_port "$port")
    if [ -n "$pids" ]; then
      for pid in $pids; do
        echo "PID $pid still alive — sending SIGKILL..."
        kill -9 "$pid" || echo "Failed to send SIGKILL to $pid"
      done
    fi
  done
fi

# Extra safety: aggressively kill known Next.js server processes that may linger
# This prevents mismatched build assets being served by stale instances.
echo "Ensuring no stray Next.js processes remain..."
if command -v pkill >/dev/null 2>&1; then
  pkill -f 'next-server' || true
  pkill -f 'next start' || true
  pkill -f 'next build' || true
fi

# Small wait to let the OS release sockets
sleep 1

# Re-check ports and force kill any remaining owners
for port in "${ports[@]}"; do
  pids=$(get_pids_for_port "$port")
  if [ -n "$pids" ]; then
    echo "Port $port still in use by PID(s): $pids — sending SIGKILL..."
    for pid in $pids; do
      kill -9 "$pid" || true
    done
  fi
done

# Verify ports are free before proceeding
for port in "${ports[@]}"; do
  if ss -ltnp 2>/dev/null | egrep -q ":${port}\b"; then
    echo "ERROR: Port $port still in use after forced kill. Aborting to avoid starting duplicate processes."
    exit 1
  fi
done

# Build backend and frontend
echo "Building backend (root)..."
pnpm build

echo "Building frontend..."
# Ensure we don't serve a partially reused / inconsistent Next.js build.
# A clean .next directory prevents chunk mismatches after restarts/deploys.
rm -rf frontend/.next
# Run frontend build and save logs for easier debugging
if ! BACKEND_URL=http://localhost:4010 pnpm --prefix frontend build > logs/frontend-build.log 2>&1; then
  echo "Frontend build failed. See logs/frontend-build.log for details."
  show_log_tail "logs/frontend-build.log"
  exit 1
fi
# Show the last lines of build log for quick feedback
echo "==== Frontend build output (tail) ===="
tail -n 50 logs/frontend-build.log || true

# Helper to aggressively kill any process listening on a TCP port
kill_port_pids() {
  local port="$1"
  local pids
  pids=$(get_pids_for_port "$port" || true)
  if [ -n "$pids" ]; then
    echo "Killing processes on port $port: $pids"
    for pid in $pids; do
      kill "$pid" 2>/dev/null || true
    done
    sleep 1
    pids=$(get_pids_for_port "$port" || true)
    if [ -n "$pids" ]; then
      echo "Some PIDs still alive on port $port, sending SIGKILL: $pids"
      for pid in $pids; do
        kill -9 "$pid" 2>/dev/null || true
      done
      sleep 1
    fi
  fi
}

# Start backend and frontend with PM2
# PM2 will keep the processes running and restart them if they crash
kill_port_pids 4010
kill_port_pids 4011

echo "Starting backend on port 4010 with PM2..."
NODE_ENV=production NODE_OPTIONS=--require=./scripts/tsconfig-paths-dist-register.js PORT=4010 \
  pm2 start "pnpm start" \
    --name "backend" \
    --cwd "$ROOT_DIR" \
    -o logs/backend-prod.log \
    -e logs/backend-prod-error.log \
    --wait-ready \
    --listen-timeout 10000

echo "Starting frontend on port 4011 with PM2..."
NODE_ENV=production PORT=4011 BACKEND_URL=http://localhost:4010 NEXTAUTH_URL=http://localhost:4011 \
  pm2 start "pnpm start" \
    --name "frontend" \
    --cwd "$ROOT_DIR/frontend" \
    -o ../logs/frontend-prod.log \
    -e ../logs/frontend-prod-error.log \
    --wait-ready \
    --listen-timeout 10000

echo "PM2 processes started with monitoring enabled."
sleep 1

# Verify backend
if check_port 4010 10; then
  echo "✅ Backend is listening on port 4010"
else
  echo "❌ ERROR: Backend did NOT start listening on port 4010"
  show_log_tail "logs/backend-prod.log"
  pm2 delete backend || true
  exit 1
fi

# Verify frontend
if check_port 4011 10; then
  echo "✅ Frontend is listening on port 4011"
else
  echo "❌ ERROR: Frontend did NOT start listening on port 4011"
  show_log_tail "logs/frontend-prod.log"
  pm2 delete frontend || true
  exit 1
fi

echo "✅ Production servers started with PM2."
echo "   Backend: http://localhost:4010 (PM2 app: backend)"
echo "   Frontend: http://localhost:4011 (PM2 app: frontend)"
echo ""
echo "PM2 is running in daemon mode (background)."
echo ""
echo "PM2 Commands:"
echo "   pm2 status              - Show all processes"
echo "   pm2 logs backend        - View backend logs (live)"
echo "   pm2 logs frontend       - View frontend logs (live)"
echo "   pm2 logs                - View all logs"
echo "   pm2 stop backend        - Stop backend"
echo "   pm2 stop frontend       - Stop frontend"
echo "   pm2 restart backend     - Restart backend"
echo "   pm2 restart frontend    - Restart frontend"
echo "   pm2 delete backend      - Delete backend from PM2"
echo "   pm2 delete frontend     - Delete frontend from PM2"
echo "   pm2 delete all          - Delete all processes from PM2"
echo "   pm2 kill                - Kill PM2 daemon and all processes"