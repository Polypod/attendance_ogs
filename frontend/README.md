# Frontend

The Next.js 16 interface for the attendance system. It uses NextAuth for
sessions and the Express backend for application data.

## Local startup

Start the backend and MongoDB first by following the root project's
[README](../README.md).

```bash
pnpm install
```

Then create `frontend/.env.local`:

```dotenv
PORT=4001
NEXTAUTH_URL=http://localhost:4001
NEXTAUTH_SECRET=<random-secret>
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Start the application:

```bash
pnpm run dev
```

The frontend is available at [http://localhost:4001](http://localhost:4001).

## Environment variables

| Variable | Usage |
| --- | --- |
| `PORT` | Next.js port, normally `4001`. |
| `NEXTAUTH_URL` | External URL that the user opens. |
| `NEXTAUTH_SECRET` | Secret for NextAuth sessions. |
| `BACKEND_URL` | Backend URL for server code, login, and the API proxy. |
| `NEXT_PUBLIC_API_URL` | Backend URL used by client code; leave empty for relative proxy requests. |

For remote development, `NEXT_PUBLIC_API_URL` may be empty, but `BACKEND_URL`
must still point to an address that the Next.js server can reach. In
production, at least one of these two backend URLs must be set.

## API requests and authentication

Client code uses `fetchWithAuth` or `createApiClient` from `src/lib/api.ts`.
They add the user's access token and use the relative `/api/...` proxy when
`NEXT_PUBLIC_API_URL` is empty. The proxy forwards the request to the Express
backend.

NextAuth sends login credentials to the backend's `POST /api/auth/login`.
The session contains access and refresh tokens; the access token is attached
to authenticated API requests.

## Commands

| Command | Description |
| --- | --- |
| `pnpm run dev` | Starts the development server. |
| `pnpm run build` | Creates a production build. |
| `pnpm start` | Starts the production build. |
| `pnpm run lint` | Runs the Next.js lint command. |

## Structure

```text
src/app/                 Pages and Next.js route handlers
src/app/api/[...path]/   Proxy to the Express API
src/components/          Shared components
src/hooks/               React hooks
src/lib/                 API, authentication, and logging helpers
```
