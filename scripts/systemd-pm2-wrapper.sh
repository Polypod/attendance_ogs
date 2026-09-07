#!/bin/bash
# Wrapper script for systemd to start PM2 with proper NVM environment

# Source NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Set PM2_HOME
export PM2_HOME="$HOME/.pm2"

# Ensure logs directory exists
mkdir -p /home/patrik/attendance_ogs/logs

# Configure PM2 log rotation (best-effort). This prevents unbounded growth of
# logs/* files produced by PM2 out_file/error_file.
if [ -x /home/patrik/attendance_ogs/scripts/setup-pm2-logrotate.sh ]; then
	/home/patrik/attendance_ogs/scripts/setup-pm2-logrotate.sh || true
fi

# Start attendance_ogs (backend + frontend)
cd /home/patrik/attendance_ogs
pm2 startOrReload ecosystem.config.js

# Start OGS app (ogs-app)
cd /home/patrik/OGS
pm2 startOrReload ecosystem.config.cjs --only ogs-app

# Keep the wrapper running (PM2 daemon runs in background)
# Use exec to replace shell with sleep so systemd keeps monitoring
exec sleep infinity
