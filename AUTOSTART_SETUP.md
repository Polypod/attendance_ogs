# Automatic startup with PM2 and systemd

This guide describes a general installation. The previous machine-specific
status report and absolute paths were intentionally removed because they
cannot serve as instructions for other installations.

## Preparation

1. Build the backend and frontend from the project root:

   ```bash
   pnpm install
   pnpm -C frontend install
   pnpm run build
   BACKEND_URL=http://127.0.0.1:4010 pnpm -C frontend run build
   ```

2. Install PM2 for the deployment user and create a dedicated
   `ecosystem.config.js` with the correct paths, domain, secrets, and backend
   URL. The included file contains example values from a specific server and
   must not be used directly without review.

3. Confirm that the backend production environment has `MONGODB_URI`,
   `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `FRONTEND_URL`, and that the frontend
   environment has `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and `BACKEND_URL`.

## Start and check

```bash
pm2 start ecosystem.config.js --env production
pm2 status
pm2 logs
```

Verify that the health check responds before enabling automatic startup:

```bash
curl --fail http://127.0.0.1:4010/api/health
```

## Enable at reboot

Use PM2's setup command for the deployment user that will own the processes,
then follow the instructions printed by the command:

```bash
pm2 startup
pm2 save
```

The system service and the user's home directory are environment-specific.
Review the generated systemd configuration, ownership, environment variables,
and log directories before enabling the service.

## Operations

```bash
pm2 status
pm2 logs backend
pm2 logs frontend
pm2 restart backend
pm2 restart frontend
```

Configure log rotation for PM2 logs. The project includes
`scripts/setup-pm2-logrotate.sh`, which can be used once PM2 and its
permissions are installed correctly.
