#!/usr/bin/env bash
set -euo pipefail

# Script som kollar portar 4000 och 4001, dödar processer som lyssnar
# och sedan kör `pnpm run dev:all` från repo-root.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ports=(4000 4001)

get_pids_for_port() {
  local port="$1"
  local pids=""
  # Try multiple tools and combine results to be more robust across systems
  local list=""
  if command -v lsof >/dev/null 2>&1; then
    list+="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)\n"
  fi
  if command -v ss >/dev/null 2>&1; then
    # ss output contains pid=<num>, extract the pid number only using a regex
    list+="$(ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p || $5 ~ p {for(i=1;i<=NF;i++) if($i ~ /pid=/){ if(match($i, /pid=([0-9]+)/, m)) print m[1] }}' || true)\n"
  fi
  if command -v netstat >/dev/null 2>&1; then
    # netstat shows "PID/program", extract only the leading PID digits
    list+="$(netstat -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p { if(match($7, /^([0-9]+)/, m)) print m[1] }' || true)\n"
  fi

  # Normalize: split on whitespace/newlines, remove empties and duplicates
  echo -e "$list" | tr ' ' '\n' | sed '/^$/d' | sort -n -u || true
}

echo "Kontrollerar portar: ${ports[*]}"
found_any=0
for port in "${ports[@]}"; do
  pids=$(get_pids_for_port "$port")
  if [ -n "$pids" ]; then
    found_any=1
    echo "Port $port används av PID(s):"
    echo "$pids"
    for pid in $pids; do
      echo "Skickar SIGTERM till PID $pid..."
      kill "$pid" || echo "Misslyckades att skicka SIGTERM till $pid"
    done
  else
    echo "Port $port fri."
  fi
done

if [ "$found_any" -eq 1 ]; then
  echo "Väntar 2 sekunder för att processerna ska avslutas..."
  sleep 2
  # Tvinga död om något fortfarande ligger kvar
  for port in "${ports[@]}"; do
    pids=$(get_pids_for_port "$port")
    if [ -n "$pids" ]; then
      for pid in $pids; do
        echo "PID $pid fortfarande aktiv — skickar SIGKILL..."
        kill -9 "$pid" || echo "Misslyckades att skicka SIGKILL till $pid"
      done
    fi
  done
fi

echo "Startar 'pnpm run dev:all'..."
exec pnpm run dev:all
