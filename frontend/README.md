# Frontend

Next.js 16-gränssnittet för närvarosystemet. Det använder NextAuth för
sessioner och Express-backenden för verksamhetsdata.

## Starta lokalt

Kör först backend och MongoDB enligt rotprojektets [README](../README.md).

```bash
pnpm install
```

Skapa därefter `frontend/.env.local`:

```dotenv
PORT=4001
NEXTAUTH_URL=http://localhost:4001
NEXTAUTH_SECRET=<slumpmässig-hemlighet>
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Starta appen:

```bash
pnpm run dev
```

Frontend finns på [http://localhost:4001](http://localhost:4001).

## Miljövariabler

| Variabel | Användning |
| --- | --- |
| `PORT` | Next.js-port, normalt `4001`. |
| `NEXTAUTH_URL` | Den externa adress som användaren öppnar. |
| `NEXTAUTH_SECRET` | Hemlighet för NextAuth-sessioner. |
| `BACKEND_URL` | Backend-adress för serverkod, inloggning och API-proxy. |
| `NEXT_PUBLIC_API_URL` | Backend-adress som används av klientkod; lämna tom för relativa proxy-anrop. |

För fjärrutveckling kan `NEXT_PUBLIC_API_URL` lämnas tomt, men `BACKEND_URL`
måste fortfarande peka på en adress som Next.js-servern når. I produktion
måste minst en av dessa två backend-adresser vara satt.

## API-anrop och autentisering

Klientkod använder `fetchWithAuth` eller `createApiClient` från
`src/lib/api.ts`. De lägger till användarens access-token och använder den
relativa `/api/...`-proxyn när `NEXT_PUBLIC_API_URL` är tom. Proxyn skickar
begäran vidare till Express-backenden.

NextAuth skickar inloggningsuppgifter till backendens
`POST /api/auth/login`. Sessionen innehåller access- och refresh-token;
access-token läggs på autentiserade API-anrop.

## Kommandon

| Kommando | Beskrivning |
| --- | --- |
| `pnpm run dev` | Startar utvecklingsservern. |
| `pnpm run build` | Skapar produktionsbygge. |
| `pnpm start` | Startar produktionsbygget. |
| `pnpm run lint` | Kör Next.js lint-kommando. |

## Struktur

```text
src/app/                 Sidor och Next.js route handlers
src/app/api/[...path]/   Proxy till Express API
src/components/          Delade komponenter
src/hooks/               React-hooks
src/lib/                 API-, autentiserings- och loggningshjälpmedel
```
