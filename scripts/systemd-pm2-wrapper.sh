#!/bin/bash
# Wrapper script for systemd to start PM2 with proper NVM environment

# Source NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Set PM2_HOME
export PM2_HOME="$HOME/.pm2"

# Ensure logs directory exists
mkdir -p /home/patrik/attendance_ogs/logs

# Start PM2 with ecosystem.config.js
cd /home/patrik/attendance_ogs
pm2 start ecosystem.config.js

# Keep the wrapper running (PM2 daemon runs in background)
# Use exec to replace shell with sleep so systemd keeps monitoring
exec sleep infinity
