# Karate School Attendance System

A full-stack system for managing students, classes, attendance, reports, and
unattended attendance registration. The backend is an Express application with
MongoDB, and the frontend is a Next.js application.

## Features

- Authentication and authorization for administrators, instructors, staff, and students.
- Management of students, classes, and individual scheduled sessions.
- Attendance per student, session, and category.
- Reports and CSV student import/export.
- Configurable categories and belt levels in `config/system.yaml`.
- Kiosk mode with dedicated device keys for attendance registration.

## Prerequisites

- Node.js 20.9.0 or later
- pnpm
- MongoDB, locally or through Docker Compose

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   pnpm --dir frontend install
   ```

2. Create backend configuration:

   ```bash
   cp .env.example .env
   ```

   Set at least `MONGO_INITDB_ROOT_PASSWORD`, and replace the placeholders in
   `MONGODB_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`. When using Docker,
   the username, password, and database in `.env` must match the Compose configuration.

3. Create `frontend/.env.local`. There is no frontend template file; use this
   local example:

   ```dotenv
   PORT=4001
   NEXTAUTH_URL=http://localhost:4001
   NEXTAUTH_SECRET=<random-secret>
   BACKEND_URL=http://localhost:4000
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```

4. Start the database:

   ```bash
   docker compose up -d
   ```

5. Create the first administrator:

   ```bash
   pnpm run seed:admin
   ```

   The default account is `admin@karateattendance.com` with password
   `ChangeMe123!`. Change the password immediately after the first login. In
   environments where the default account should not be used, set
   `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before running the command.

6. Start both development servers:

   ```bash
   ./scripts/start-dev.sh
   ```

   Alternatively, start them separately with `pnpm run dev` and
   `pnpm run dev:frontend`.

Then open [http://localhost:4001](http://localhost:4001). The backend health
check is available at [http://localhost:4000/api/health](http://localhost:4000/api/health).

> `scripts/start-dev.sh` terminates processes already listening on ports 4000
> and 4001. Use the separate commands if that is not desired.

## Configuration

See [CONFIGURATION.md](CONFIGURATION.md) for all environment variables, port
configuration, and troubleshooting.

Categories and belt levels are read from `config/system.yaml`. Changes require
a backend restart. Do not change an existing `value` once it is used in the
database.

## Common commands

| Command | Description |
| --- | --- |
| `pnpm run dev` | Starts the backend in development mode. |
|| `pnpm run dev:frontend` | Starts the frontend in development mode (POSIX-only script; Windows: use `pnpm -C frontend run dev`). |
|| `pnpm run dev:all` | Starts both development servers in one shell (POSIX-only; Windows: use two terminals). |
| `pnpm test` | Runs backend tests. |
| `pnpm run build` | Builds the backend. |
| `pnpm -C frontend run build` | Builds the frontend. |
| `pnpm run verify` | Runs tests and builds both applications. |
| `pnpm run seed:admin` | Creates or updates the administrator account. |
| `pnpm run seed:kiosks` | Creates kiosk device sample data. |

## API overview

All `/api` endpoints are subject to general rate limiting. In addition to the
public authentication, configuration, and kiosk endpoints, a JWT in the
`Authorization` header is required.

| Resource | Base path | Access |
| --- | --- | --- |
| Health | `GET /api/health` | Public |
| Configuration | `GET /api/config` | Public |
| Authentication | `/api/auth` | Login and token refresh are public |
| Students | `/api/students` | Authenticated; changes require administrator |
| Classes and schedules | `/api/classes`, `/api/schedules` | Authenticated, role-based |
| Attendance | `/api/attendance` | Authenticated; recording for admin/instructor/staff |
| Reports | `/api/reports`, `/api/report-presets` | Administrator or instructor |
| Kiosks | `/api/kiosks` | Administrator |
| Kiosk attendance | `/api/kiosk-attendance` | Device key |
| Metrics | `GET /api/metrics` | Requires `METRICS_TOKEN` |

The route definitions in `src/routes/` are the complete and current reference
for parameters, validation, and authorization.

## Production

Build both applications and set environment variables in the deployment
environment. In production, the frontend must have `BACKEND_URL` (or
`NEXT_PUBLIC_API_URL`) for server-side calls and the Next.js proxy. Do not use
default secrets or passwords.

`./scripts/start-prod.sh` is intended for local production-like testing. It
builds both applications, uses PM2, and starts the backend on 4010 and the
frontend on 4011. See [AUTOSTART_SETUP.md](AUTOSTART_SETUP.md) for a general
PM2/systemd installation.

## Project structure

```text
src/                 Express routes, controllers, services, and models
config/system.yaml   Categories and belt levels
frontend/            Next.js application
scripts/             Development, operations, and seed scripts
```
