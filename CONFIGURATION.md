# Konfigurationsguide

Applikationen har två konfigurationsfiler som inte ska versionshanteras:
`.env` för Express-backenden och `frontend/.env.local` för Next.js.

## Backend: `.env`

Börja med `cp .env.example .env` och ersätt alla platshållare.

| Variabel | Krävs | Beskrivning |
| --- | --- | --- |
| `MONGODB_URI` | Ja | MongoDB-anslutning för applikationen. |
| `MONGO_INITDB_ROOT_USERNAME` | Vid Docker | Administratörsnamn som Docker MongoDB skapar. |
| `MONGO_INITDB_ROOT_PASSWORD` | Vid Docker | Administratörslösenord som Docker MongoDB använder. |
| `MONGO_INITDB_DATABASE` | Nej | Databas som initieras av Docker; standard är `attendance`. |
| `PORT` | Ja | Backendens lyssningsport; lokal standard i mallen är `4000`. |
| `FRONTEND_URL` | Ja | Frontendens origin för CORS, normalt `http://localhost:4001`. |
| `JWT_SECRET` | Ja | Hemlighet för access-token. |
| `JWT_REFRESH_SECRET` | Ja | Hemlighet för refresh-token. |
| `JWT_EXPIRES_IN` | Nej | Giltighetstid för access-token; standard `24h`. |
| `JWT_REFRESH_EXPIRES_IN` | Nej | Giltighetstid för refresh-token; standard `7d`. |
| `METRICS_TOKEN` | För `/api/metrics` | Token som skyddar mätvärdes-endpointen. |
| `LOG_LEVEL` | Nej | Loggnivå. |
| `SLOW_REQUEST_THRESHOLD_MS` | Nej | Gräns för loggning av långsamma anrop. |
| `SEED_ADMIN_EMAIL` | Nej | E-post för `seed:admin`; standard är `admin@karateattendance.com`. |
| `SEED_ADMIN_PASSWORD` | Nej | Lösenord för `seed:admin`; standard är `ChangeMe123!`. |

`BCRYPT_ROUNDS` är inte en aktiv inställning; lösenord hash-as med 10 rundor i
modellen. Lägg därför inte till variabeln i driftkonfiguration i förväntan att
den ändrar beteendet.

## Frontend: `frontend/.env.local`

Skapa filen manuellt; projektet har ingen `frontend/.env.example`.

```dotenv
PORT=4001
NEXTAUTH_URL=http://localhost:4001
NEXTAUTH_SECRET=<slumpmässig-hemlighet>
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

| Variabel | Krävs | Beskrivning |
| --- | --- | --- |
| `PORT` | Ja | Next.js-porten, normalt `4001`. |
| `NEXTAUTH_URL` | Ja | URL:en som användaren öppnar i webbläsaren. |
| `NEXTAUTH_SECRET` | Ja | Hemlighet för NextAuth-sessioner. |
| `BACKEND_URL` | Rekommenderas | Intern backend-adress för NextAuth och Next.js API-proxy. |
| `NEXT_PUBLIC_API_URL` | Nej | Backend-adress för klientkod. En tom sträng använder Next.js-proxyn. |
| `NEXT_PUBLIC_LOG_LEVEL` | Nej | Loggnivå i klientmiljö. |

Backend-adress väljs i denna ordning: `BACKEND_URL`,
`NEXT_PUBLIC_API_URL`, och i utvecklingsläge sist `http://localhost:4000`.
I produktion finns ingen lokal reservadress, så minst en backend-adress måste
vara satt.

## Lokala portar och Docker

| Tjänst | Värdport | Intern port |
| --- | --- | --- |
| Express-backend | 4000 | 4000 |
| Next.js-frontend | 4001 | 4001 |
| MongoDB via Docker | 27019 | 27017 |

Använd `docker compose up -d` för MongoDB. Din `MONGODB_URI` måste använda
port 27019 och samma autentiseringsuppgifter som
`MONGO_INITDB_ROOT_USERNAME` och `MONGO_INITDB_ROOT_PASSWORD`.

Om portarna ändras ska `FRONTEND_URL`, `NEXTAUTH_URL`, `BACKEND_URL` och
`NEXT_PUBLIC_API_URL` uppdateras så att de fortsätter peka på rätt tjänst.

## Säker drift

- Generera unika, starka hemligheter för JWT och NextAuth.
- Använd aldrig standardlösenordet för administratören i produktion.
- Sätt `NODE_ENV=production` och använd HTTPS framför applikationen.
- Spara hemligheter i driftplattformens hemlighetshantering, inte i Git.
- Sätt `METRICS_TOKEN` innan `/api/metrics` exponeras.

## Rate limiting

Gränserna är kodkonstanter, inte miljövariabler:

| Endpointtyp | Gräns |
| --- | --- |
| Inloggning | 5 försök per 15 minuter |
| Tokenförnyelse | 30 försök per 15 minuter |
| Övriga API-anrop | 100 per 15 minuter, eller 1 000 för autentiserade anrop |

## Felsökning

**MongoDB går inte att ansluta**

Kontrollera `docker compose ps`, port 27019 och att uppgifterna i `.env`
matchar Docker-konfigurationen.

**CORS eller ”Failed to fetch”**

Kontrollera att `FRONTEND_URL` exakt motsvarar frontendens origin och starta
om backend.

**Inloggning misslyckas**

Kontrollera att backend är nåbar på port 4000, att `BACKEND_URL` når den från
Next.js-servern och att administratören har seedats.

**Dashboarden laddar inte vid fjärrutveckling**

Lämna `NEXT_PUBLIC_API_URL` tomt för att använda proxyn, och konfigurera
`BACKEND_URL` till en adress som Next.js-servern kan nå.
