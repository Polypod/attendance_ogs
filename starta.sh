#!/usr/bin/env bash
set -euo pipefail

# Interactive script to choose which environment to start
# 1 = Development
# 2 = Production
# 3 = Both

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=========================================="
echo "  Karate Attendance System - Startup"
echo "=========================================="
echo ""
echo "Välj miljö att starta:"
echo ""
echo "  1) Utveckling (Development)"
echo "     - Backend på port 4000"
echo "     - Frontend på port 4001"
echo "     - Hot reload aktiverat"
echo ""
echo "  2) Produktion (Production)"
echo "     - Backend på port 4010"
echo "     - Frontend på port 4011"
echo "     - Optimerad körning"
echo ""
echo "  3) Båda miljöer"
echo "     - Startar både development och production"
echo ""
echo "  (Tryck Ctrl+C för att avbryta)"
echo ""

read -p "Välj (1/2/3): " choice

case "$choice" in
  1)
    echo ""
    echo "Startar utvecklingsmiljö..."
    echo ""
    exec ./scripts/start-dev.sh
    ;;
  2)
    echo ""
    echo "Startar produktionsmiljö..."
    echo ""
    exec ./scripts/start-prod.sh
    ;;
  3)
    echo ""
    echo "Startar båda miljöer..."
    echo ""
    echo "🚀 Startar produktionsmiljö i bakgrunden..."
    ./scripts/start-prod.sh &
    prod_pid=$!
    sleep 3
    
    echo ""
    echo "🚀 Startar utvecklingsmiljö..."
    echo ""
    ./scripts/start-dev.sh &
    dev_pid=$!
    
    echo ""
    echo "=========================================="
    echo "  ✅ Båda miljöer startade!"
    echo "=========================================="
    echo ""
    echo "Production: http://localhost:4010-4011"
    echo "Development: http://localhost:4000-4001"
    echo ""
    echo "PM2-kommandon:"
    echo "  pm2 status    - Visa alla processer"
    echo "  pm2 logs      - Se alla loggar"
    echo "  pm2 kill      - Stoppa allt"
    echo ""
    
    # Wait for processes
    wait
    ;;
  *)
    echo ""
    echo "❌ Ogiltigt val. Vänligen välj 1, 2 eller 3."
    exit 1
    ;;
esac
