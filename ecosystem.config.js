module.exports = {
  apps: [
    // ========================================
    // PRODUCTION ENVIRONMENT
    // Backend: Compiled Node.js server (port 4010)
    // Frontend: Next.js production server (port 4011)
    //
    // Auto-starts on server reboot via systemd:
    //   ExecStart=pm2 start /home/patrik/attendance_ogs/ecosystem.config.js --env production
    //
    // Manual start:
    //   pm2 start ecosystem.config.js
    // ========================================
    {
      name: 'backend',
      script: 'pnpm',
      args: 'start',
      cwd: '/home/patrik/attendance_ogs',
      env: {
        NODE_ENV: 'production',
        PORT: 4010,
        NODE_OPTIONS: '--require=./scripts/tsconfig-paths-dist-register.js',
      },
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      autorestart: true,
      max_memory_restart: '500M',
      out_file: './logs/backend-prod.log',
      error_file: './logs/backend-prod-error.log',
      merge_logs: true,
      // Wait for port to become available before marking as "online"
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
    {
      name: 'frontend',
      script: 'pnpm',
      args: 'start',
      cwd: '/home/patrik/attendance_ogs/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 4011,
        BACKEND_URL: 'http://localhost:4010',
        NEXTAUTH_URL: 'https://att.minamail.se',
        NEXTAUTH_SECRET: 'production_secret_change_me_to_random_string',
      },
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      autorestart: true,
      max_memory_restart: '500M',
      out_file: '../logs/frontend-prod.log',
      error_file: '../logs/frontend-prod-error.log',
      merge_logs: true,
      // Wait for port to become available before marking as "online"
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
  ],

  // Global settings for all apps
  max_restarts: 10,
  min_uptime: '10s',
  autorestart: true,
  max_memory_restart: '500M',
  error_file: './logs/pm2-error.log',
  out_file: './logs/pm2-out.log',

  // Deploy configuration (optional for future use)
  deploy: {
    production: {
      user: 'patrik',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/Polypod/attendance_ogs.git',
      path: '/home/patrik/attendance_ogs',
      'post-deploy':
        'pnpm install && pnpm build && pnpm --prefix frontend build && pm2 reload ecosystem.config.js --env production',
    },
  },
};
