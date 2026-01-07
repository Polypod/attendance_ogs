#!/usr/bin/env bash
set -euo pipefail

# Script to start backend and frontend in "production" locally on ports
# Backend: 4010
# Frontend: 4011
# It will kill any process listening on those ports, build both apps, then start them.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ports=(4010 4011)

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
# Run frontend build and save logs for easier debugging
if ! pnpm --prefix frontend build > logs/frontend-build.log 2>&1; then
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

# Start backend and frontend with specified ports
# Ensure no lingering process occupies the ports
kill_port_pids 4010
kill_port_pids 4011

echo "Starting backend on port 4010..."
# Ensure runtime path aliases work (tsconfig paths) when running compiled code
NODE_OPTIONS=--require=./scripts/tsconfig-paths-dist-register.js PORT=4010 nohup pnpm start > logs/backend-prod.log 2>&1 &
backend_pid=$!

# Before starting frontend, ensure port is free
kill_port_pids 4011

echo "Starting frontend on port 4011..."
cd frontend
PORT=4011 nohup pnpm start > ../logs/frontend-prod.log 2>&1 &
frontend_pid=$!
cd ..


# Save PIDs
echo "$backend_pid" > .prod_backend.pid
echo "$frontend_pid" > .prod_frontend.pid

echo "Backend PID: $backend_pid (logs/backend-prod.log)"
echo "Frontend PID: $frontend_pid (logs/frontend-prod.log)"

echo "Waiting briefly for services to bind to ports..."
sleep 1

# Verify backend
if check_port 4010 10; then
  echo "✅ Backend is listening on port 4010"
else
  echo "❌ ERROR: Backend did NOT start listening on port 4010"
  show_log_tail "logs/backend-prod.log"
  exit 1
fi

# Verify frontend
if check_port 4011 10; then
  echo "✅ Frontend is listening on port 4011"
else
  echo "❌ ERROR: Frontend did NOT start listening on port 4011"
  show_log_tail "logs/frontend-prod.log"
  exit 1
fi

echo "Production servers started and verified. Use the PID files (.prod_backend.pid/.prod_frontend.pid) to stop them or check logs."