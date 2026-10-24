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
| `OGS_SYNC_URL` | For member sync | Member export endpoint in the OGS project. |
| `OGS_SYNC_API_KEY` | For member sync | Payload API key of the OGS sync service user. |
| `OGS_SYNC_TIMEOUT_MS` | No | Export request timeout; defaults to `30000`. |
| `MEMBER_SYNC_ENABLED` | No | Set to `true` to arm the nightly sync; off otherwise. |
| `MEMBER_SYNC_HOUR` | No | Hour of the nightly sync (0-23); defaults to `3`. |
| `MEMBER_SYNC_MINUTE` | No | Minute of the nightly sync (0-59); defaults to `0`. |
| `MEMBER_SYNC_TIMEZONE` | No | Timezone for the schedule; defaults to `Europe/Stockholm`. |
| `OGS_OIDC_ISSUER` | For OGS SSO | Issuer URL of the OGS OIDC provider; must equal the frontend's value. |
| `OGS_OIDC_CLIENT_ID` | For OGS SSO | Client id of attendance in OGS; the ID token audience. |
| `OGS_OIDC_JWKS_URI` | No | Signing keys URL; read from the issuer's discovery document when unset. |
| `SSO_INTERNAL_SECRET` | For OGS SSO | Shared with the frontend; guards `POST /api/auth/sso/ogs`. |
| `OGS_STAFF_URL` | No | OGS staff export; defaults to `OGS_SYNC_URL` with `/members` replaced by `/staff`. |
| `JWT_SSO_EXPIRES_IN` | No | Access-token lifetime of an OGS SSO session; defaults to `5m`. |

`BCRYPT_ROUNDS` is not an active setting; passwords are hashed with 10 rounds
in the model. Do not add it to deployment configuration expecting it to alter
application behavior.

### Member register sync

The OGS member register is the source of truth for member identity. Mapping
between the two systems lives in `config/system.yaml` under `member_sync`, not
in code, so categories and belt levels can be adjusted without a release.

- `category_map` maps a member category name in OGS to local categories.
- `unmapped_category_action` decides what happens to members whose category is
  missing or unmapped: `report` (skip and flag for review), `skip`, or
  `default` (use `default_categories`). A student requires at least one
  category, so these members cannot simply be created anyway.
- `belt_map` identifies known OGS belt colors. For non-black colors, the local
  level is determined by the number in `kyuDanGrade` (for example, 7 becomes
  `7kyu`); the old fixed color mappings are ignored. A `null` entry clears the
  belt for a non-color grade such as `instructor`. An unknown color, missing kyu
  number, or kyu number with no local level leaves the belt untouched and raises
  a warning.
- `dan_grades` lists colors for which `kyuDanGrade` is interpreted as a dan
  number. OGS has a single `black` option for every dan, so black belts resolve
  through `dan_map`.
- `dan_map` maps a dan number to a local belt level. A black belt with no dan
  number, or one outside the map, leaves the belt untouched and is flagged for
  review rather than falling back to the lowest dan.
- `deactivate_missing` deactivates students whose member disappeared from the
  export entirely.

Admins can preview and trigger a sync from Settings in the dashboard, or call
`POST /api/sync/members/preview`, `POST /api/sync/members/run`, and
`GET /api/sync/members/status` directly. Every run is recorded in the
`membersyncruns` collection. The sync never deletes students, and never
modifies students that were created locally.

### OGS single sign-on

Users can sign in with their OGS account (see `SSO_IMPLEMENTATION_PLAN.md`).
An admin links each attendance user to an OGS account under Users and ticks
"Allow sign-in through OGS". Accounts are never matched on email.

- Only OGS accounts that are approved, not marked inactive, and hold `admin`
  or `editor` get in. OGS only decides who gets in: the role is the one set
  in attendance and is never overwritten, so an OGS admin can be an editor
  here.
- The Next.js server sends the ID token from OGS to
  `POST /api/auth/sso/ogs` with the `X-Internal-Secret` header. The backend
  verifies the token's signature, issuer, audience and age itself, accepts
  each token once, and asks OGS (`/api/attendance-sync/staff`, with the
  member sync API key) whether the account is still admin or editor there.
- An SSO session's access token lives 5 minutes. Every refresh asks OGS
  again, so a removed role or deactivated account ends the session within
  about 5 minutes. When OGS cannot be reached, access is refused.
- Production attendance trusts only the production issuer
  (`https://gojuryu.se`). Test the flow against `https://ogs.minamail.se`
  from a local or temporary instance, never by pointing production at it.

### Rotating the OGS sign-on secrets

The same procedure is in the OGS project's `CLAUDE.md` ("Rotating the sign-on
secrets"); keep the two in step. Production is `att.minamail.se` with OGS on
`gojuryu.se`; the test environment `ogs.minamail.se` has its own values and
is rotated the same way. Restart attendance with `./starta.sh` (choice 2).
Restart OGS with `pm2 restart ogs-app` in production and `omstarta` in the
test environment; a secret change needs no rebuild, so do not run OGS's
`deploy_ogs.sh` for it. On the OGS server the environment file is
`.env.production` when it exists, otherwise `.env`; a value in `.env.local`
overrides both.

| Secret | Where it lives | Effect of a change |
| --- | --- | --- |
| `OGS_OIDC_ISSUER` | backend `.env`, `frontend/.env.local`; `OIDC_ISSUER` in OGS | **Never change it.** It is stored in every OGS account link; a new value unlinks every user |
| `OGS_OIDC_CLIENT_SECRET` | `frontend/.env.local`; `OIDC_ATTENDANCE_CLIENT_SECRET` in OGS, same value | Sign-in through OGS fails until both have the new value. Running sessions are not affected |
| `SSO_INTERNAL_SECRET` | backend `.env` **and** `frontend/.env.local`, same value | Sign-in through OGS fails while the two differ. Running sessions are not affected |
| `OGS_SYNC_API_KEY` | backend `.env`; API key of the sync service user in OGS | The old key stops working as soon as OGS has a new one: member sync fails and SSO users lose access within about 5 minutes until attendance has the new key |
| Signing key and cookie keys | OGS only (`OIDC_JWKS`, `OIDC_COOKIE_KEYS`) | Nothing to change in attendance; it fetches new public keys by itself |

New OIDC values come from `node scripts/generate-oidc-config.mjs
https://gojuryu.se https://att.minamail.se` in the OGS project. Copy **only
the lines of the secret being replaced**: every run creates new values for
all of them. Keep the values out of chat, tickets and Git.

**Client secret** (`OGS_OIDC_CLIENT_SECRET`):

1. Put the new value in `frontend/.env.local` and in OGS `.env`
   (`OIDC_ATTENDANCE_CLIENT_SECRET`).
2. Restart OGS, then attendance, right after each other.
3. Sign in with **Logga in med OGS**. `invalid_client` in
   `logs/frontend-prod-error.log` means the two values differ.

**Internal secret** (`SSO_INTERNAL_SECRET`):

1. Generate a value: `openssl rand -hex 32`.
2. Put the same value in the backend `.env` and in `frontend/.env.local`.
3. Restart attendance and sign in with **Logga in med OGS**.

**Sync service user API key** (`OGS_SYNC_API_KEY`):

1. In the OGS admin panel, open the user whose email is
   `ATTENDANCE_SYNC_USER_EMAIL` in OGS, generate a new API key and save.
2. Put the new key in the backend `.env` and restart attendance straight away.
3. Check that the Users page lists OGS accounts when you edit a user, and
   that **Preview sync** under Settings > Member register sync works.

**Signing key** (`OIDC_JWKS` in OGS): nothing to do here. After OGS has
restarted, a sign-in through OGS may fail during the first minute, because
attendance fetches unknown keys at most once a minute; try again.

**If a secret has leaked**, rotate it as above. A leaked `SSO_INTERNAL_SECRET`
alone does not let anyone sign in, since the backend also requires an ID token
signed by OGS, but replace it anyway.

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
| `OGS_OIDC_ISSUER` | For OGS SSO | Issuer URL of the OGS OIDC provider. The "Logga in med OGS" button only shows when this and the two below are set. |
| `OGS_OIDC_CLIENT_ID` | For OGS SSO | Client id of attendance in OGS. |
| `OGS_OIDC_CLIENT_SECRET` | For OGS SSO | Client secret of attendance in OGS. |
| `SSO_INTERNAL_SECRET` | For OGS SSO | Same value as in the backend `.env`. |

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

The MongoDB port is published on `127.0.0.1` only (`127.0.0.1:27019:27017`), so
the database is reachable from the host but not from the network. To connect
from another machine, use an SSH tunnel or VPN rather than publishing the port
on `0.0.0.0`.

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
| Token refresh | 30 attempts per 15 minutes per refresh token (per client when none is sent) |
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
