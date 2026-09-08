# Configuration guide

The application has two configuration files that must not be versioned:
`.env` for the Express backend and `frontend/.env.local` for Next.js.

## Backend: `.env`

Start with `cp .env.example .env` and replace all placeholders.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string for the application. |
| `MONGO_INITDB_ROOT_USERNAME` | With Docker | Administrator username created by Docker MongoDB. |
| `MONGO_INITDB_ROOT_PASSWORD` | With Docker | Administrator password used by Docker MongoDB. |
| `MONGO_INITDB_DATABASE` | No | Database initialized by Docker; defaults to `attendance`. |
| `PORT` | Yes | Backend listening port; the local template default is `4000`. |
| `FRONTEND_URL` | Yes | Frontend origin for CORS, normally `http://localhost:4001`. |
| `JWT_SECRET` | Yes | Access-token secret. |
| `JWT_REFRESH_SECRET` | Yes | Refresh-token secret. |
| `JWT_EXPIRES_IN` | No | Access-token lifetime; defaults to `24h`. |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh-token lifetime; defaults to `7d`. |
| `METRICS_TOKEN` | For `/api/metrics` | Token protecting the metrics endpoint. |
| `LOG_LEVEL` | No | Log level. |
| `SLOW_REQUEST_THRESHOLD_MS` | No | Threshold for logging slow requests. |
| `SEED_ADMIN_EMAIL` | No | Email for `seed:admin`; defaults to `admin@karateattendance.com`. |
| `SEED_ADMIN_PASSWORD` | No | Password for `seed:admin`; defaults to `ChangeMe123!`. |

`BCRYPT_ROUNDS` is not an active setting; passwords are hashed with 10 rounds
in the model. Do not add it to deployment configuration expecting it to alter
application behavior.

## Frontend: `frontend/.env.local`

Create this file manually; the project has no `frontend/.env.example`.

```dotenv
PORT=4001
NEXTAUTH_URL=http://localhost:4001
NEXTAUTH_SECRET=<random-secret>
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | Next.js port, normally `4001`. |
| `NEXTAUTH_URL` | Yes | URL that the user opens in the browser. |
| `NEXTAUTH_SECRET` | Yes | Secret for NextAuth sessions. |
| `BACKEND_URL` | Recommended | Internal backend URL for NextAuth and the Next.js API proxy. |
| `NEXT_PUBLIC_API_URL` | No | Backend URL for client-side code. An empty string uses the Next.js proxy. |
| `NEXT_PUBLIC_LOG_LEVEL` | No | Client-side log level. |

The backend URL is selected in this order: `BACKEND_URL`,
`NEXT_PUBLIC_API_URL`, then `http://localhost:4000` in development. Production
has no local fallback, so at least one backend URL must be set.

## Local ports and Docker

| Service | Host port | Internal port |
| --- | --- | --- |
| Express backend | 4000 | 4000 |
| Next.js frontend | 4001 | 4001 |
| MongoDB through Docker | 27019 | 27017 |

Use `docker compose up -d` for MongoDB. Your `MONGODB_URI` must use port 27019
and the same credentials as `MONGO_INITDB_ROOT_USERNAME` and
`MONGO_INITDB_ROOT_PASSWORD`.

If ports change, update `FRONTEND_URL`, `NEXTAUTH_URL`, `BACKEND_URL`, and
`NEXT_PUBLIC_API_URL` so they continue to point to the correct service.

## Secure deployment

- Generate unique, strong secrets for JWT and NextAuth.
- Never use the default administrator password in production.
- Set `NODE_ENV=production` and use HTTPS in front of the application.
- Store secrets in the deployment platform's secret manager, not in Git.
- Set `METRICS_TOKEN` before exposing `/api/metrics`.

## Rate limiting

The limits are code constants, not environment variables:

| Endpoint type | Limit |
| --- | --- |
| Login | 5 attempts per 15 minutes |
| Token refresh | 30 attempts per 15 minutes |
| Other API requests | 100 per 15 minutes, or 1,000 for authenticated requests |

## Troubleshooting

**MongoDB cannot connect**

Check `docker compose ps`, port 27019, and that credentials in `.env` match
the Docker configuration.

**CORS or “Failed to fetch”**

Check that `FRONTEND_URL` exactly matches the frontend origin and restart the
backend.

**Login fails**

Check that the backend is reachable on port 4000, that `BACKEND_URL` can reach
it from the Next.js server, and that the administrator has been seeded.

**The dashboard does not load during remote development**

Leave `NEXT_PUBLIC_API_URL` empty to use the proxy, and configure `BACKEND_URL`
to an address reachable by the Next.js server.
