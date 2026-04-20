#!/usr/bin/env bash
set -euo pipefail

# Installs + configures PM2 log rotation.
# Safe to run multiple times.

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ pm2 not found on PATH. Install PM2 first." >&2
  exit 1
fi

# Detect whether module is already installed
if pm2 describe pm2-logrotate >/dev/null 2>&1; then
  echo "✓ pm2-logrotate already installed"
else
  echo "Installing pm2-logrotate module..."
  # Non-fatal if install fails (e.g. no network). Caller can decide.
  pm2 install pm2-logrotate
fi

# Configure rotation policy (keeps disk usage bounded)
# See: https://github.com/keymetrics/pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat "YYYY-MM-DD_HH-mm-ss"

# Rotate daily at midnight (server local time)
pm2 set pm2-logrotate:rotateInterval "0 0 * * *"

echo "✓ pm2-logrotate configured"
