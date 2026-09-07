# Setup Complete: Automatic Startup After Server Restart ✅

## Summary

✅ **System is now configured for automatic startup on server reboot!**

Both **backend** (port 4010) and **frontend** (port 4011) will start automatically when the server boots.

### 1. ✅ Created `ecosystem.config.js` (Production Configuration)
- **Location**: [/home/patrik/attendance_ogs/ecosystem.config.js](ecosystem.config.js)
- **Contains**: Backend and Frontend process definitions for production
- **Backend**: Runs on port 4010 with TypeScript path resolution
- **Frontend**: Runs on port 4011 with BACKEND_URL and NEXTAUTH_URL set
- **Logging**: Outputs to `logs/backend-prod.log`, `logs/frontend-prod.log`

### 2. ✅ Created Systemd Wrapper Script
- **Location**: [scripts/systemd-pm2-wrapper.sh](scripts/systemd-pm2-wrapper.sh)
- **Purpose**: Properly loads NVM environment before starting PM2
- **Benefit**: Dynamically finds Node.js (no hardcoded version paths)

### 3. ✅ Updated Systemd Service File
- **Location**: `/etc/systemd/system/pm2-patrik.service`
- **Type**: Changed from `forking` to `simple` for PM2 compatibility
- **ExecStart**: Uses wrapper script instead of hardcoded paths
- **Logging**: Full journalctl integration
- **Status**: Enabled for autostart ✅

### 4. ✅ Verified Working
- Backend listening on port 4010 ✅
- Frontend listening on port 4011 ✅
- PM2 processes running correctly ✅
- Systemd service is enabled ✅

## Current Status

```bash
$ systemctl status pm2-patrik.service
● pm2-patrik.service - PM2 process manager for karate-attendance-ogs
     Loaded: loaded (/etc/systemd/system/pm2-patrik.service; enabled)
     Active: active (running)

$ pm2 status
┌────┬──────────────┬──────────┬────────┬──────────┬──────────┐
│ id │ name         │ mode     │ status │ cpu      │ memory   │
├────┼──────────────┼──────────┼────────┼──────────┼──────────┤
│ 0  │ backend      │ fork     │ online │ 0%       │ 98.3mb   │
│ 1  │ frontend     │ fork     │ online │ 0%       │ 99.4mb   │
└────┴──────────────┴──────────┴────────┴──────────┴──────────┘
```

## Verification

The system is **already configured and running**. No additional commands needed!

### Check Current Status
```bash
sudo systemctl status pm2-patrik.service
pm2 status
ss -tlnp | grep -E ':(4010|4011)'
```

### View Logs
```bash
pm2 logs backend
pm2 logs frontend
journalctl -xeu pm2-patrik.service -f
```

### Log rotation (prevents disk growth)

PM2 writes process stdout/stderr to files under `logs/`. To keep disk usage bounded, log rotation is configured via the PM2 module `pm2-logrotate`.

- Setup script: `scripts/setup-pm2-logrotate.sh`
- Default policy: rotate at `10M`, keep `14` archives, `compress=true`, daily interval

Verify status:

```bash
pm2 describe pm2-logrotate
```

## Process Management

```bash
# Restart specific process
pm2 restart backend
pm2 restart frontend

# Stop processes
pm2 stop backend
pm2 stop frontend

# Start processes
pm2 start ecosystem.config.js

# View full process details
pm2 show backend
pm2 show frontend

# Kill all PM2 processes and daemon
pm2 kill
```

## Development Environment

To run development mode (hot reload) manually:

```bash
cd /home/patrik/attendance_ogs
pnpm run dev:all
```

Or with PM2:
```bash
pm2 start ecosystem.config.js -n dev-all --merge-logs
```

## What Happens on Server Reboot

1. Systemd starts `pm2-patrik.service`
2. Service loads NVM via bash login shell
3. PM2 starts processes from `ecosystem.config.js`
4. Backend starts on port 4010
5. Frontend starts on port 4011
6. Both processes are monitored and auto-restarted if they crash

## Troubleshooting

### If services don't start automatically:

1. Check systemd service:
```bash
sudo systemctl status pm2-patrik.service
journalctl -u pm2-patrik.service -n 50
```

2. Check PM2 logs:
```bash
pm2 logs
```

3. Check port availability:
```bash
ss -tlnp | grep -E ':(4010|4011)'
```

4. Manual restart:
```bash
sudo systemctl restart pm2-patrik.service
sleep 3
pm2 status
```

## Configuration Files

- **Ecosystem Config**: `ecosystem.config.js`
- **Systemd Service**: `/etc/systemd/system/pm2-patrik.service`
- **Backend Logs**: `logs/backend-prod.log`, `logs/backend-prod-error.log`
- **Frontend Logs**: `logs/frontend-prod.log`, `logs/frontend-prod-error.log`
- **PM2 Home**: `/home/patrik/.pm2/`

## Notes

- ✅ Autostart is **enabled** and **working**
- ✅ Both processes auto-restart if they crash
- ✅ NVM environment is loaded dynamically (no version hardcoding)
- ✅ Full logging integration with systemd/journalctl
- ✅ Memory limit: 500MB per process
- ✅ Listen timeout: 10 seconds for startup

---

**Status**: ✅ **PRODUCTION READY**  
**Last Updated**: 2026-02-15  
**Autostart**: ✅ **ENABLED AND VERIFIED**
