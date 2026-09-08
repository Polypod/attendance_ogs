# Närvarosystem för karateklubb

Ett fullstack-system för elever, pass, närvaro, rapporter och obemannad
närvaroregistrering. Backend är en Express-applikation med MongoDB och
frontend är en Next.js-applikation.

## Funktioner

- Inloggning och behörighet för administratör, instruktör, personal och elev.
- Hantering av elever, klasser och enskilda schematillfällen.
- Närvaro per elev, tillfälle och kategori.
- Rapporter och CSV-import/export av elever.
- Konfigurerbara kategorier och bältesgrader i `config/system.yaml`.
- Kiosk-läge med egna enhetsnycklar för närvaroregistrering.

## Förutsättningar

- Node.js 20 eller senare
- pnpm
- MongoDB, lokalt eller via Docker Compose

## Kom igång lokalt

1. Installera beroenden:

   ```bash
   pnpm install
   pnpm --dir frontend install
   ```

2. Skapa backend-konfiguration:

   ```bash
   cp .env.example .env
   ```

   Sätt minst `MONGO_INITDB_ROOT_PASSWORD` och ersätt platshållarna i
   `MONGODB_URI`, `JWT_SECRET` och `JWT_REFRESH_SECRET`. När Docker används
   ska användarnamn, lösenord och databas i `.env` matcha Compose-konfigurationen.

3. Skapa `frontend/.env.local`. Det finns ingen frontend-mallfil; använd detta
   lokala exempel:

   ```dotenv
   PORT=4001
   NEXTAUTH_URL=http://localhost:4001
   NEXTAUTH_SECRET=<slumpmässig-hemlighet>
   BACKEND_URL=http://localhost:4000
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```

4. Starta databasen:

   ```bash
   docker compose up -d
   ```

5. Skapa första administratören:

   ```bash
   pnpm run seed:admin
   ```

   Standardkontot är `admin@karateattendance.com` med lösenordet
   `ChangeMe123!`. Byt lösenordet direkt efter första inloggningen. I miljöer
   där standardkontot inte ska användas kan `SEED_ADMIN_EMAIL` och
   `SEED_ADMIN_PASSWORD` sättas före kommandot.

6. Starta båda utvecklingsservrarna:

   ```bash
   ./scripts/start-dev.sh
   ```

   Eller starta dem separat med `pnpm run dev` och `pnpm run dev:frontend`.

Öppna sedan [http://localhost:4001](http://localhost:4001). Backendens
hälsokontroll finns på [http://localhost:4000/api/health](http://localhost:4000/api/health).

> `scripts/start-dev.sh` avslutar processer som redan lyssnar på port 4000
> eller 4001. Använd de separata kommandona om det inte är önskvärt.

## Konfiguration

Se [CONFIGURATION.md](CONFIGURATION.md) för samtliga miljövariabler,
portkonfiguration och felsökning.

Kategorier och bältesgrader läses från `config/system.yaml`. Ändringar kräver
omstart av backend. Ändra inte ett befintligt `value` om det redan används i
databasen.

## Vanliga kommandon

| Kommando | Beskrivning |
| --- | --- |
| `pnpm run dev` | Startar backend i utvecklingsläge. |
| `pnpm run dev:frontend` | Startar frontend med variabler från `frontend/.env.local`. |
| `pnpm run dev:all` | Startar båda utvecklingsservrarna. |
| `pnpm test` | Kör backendtester. |
| `pnpm run build` | Bygger backend. |
| `pnpm -C frontend run build` | Bygger frontend. |
| `pnpm run verify` | Kör tester och bygger båda apparna. |
| `pnpm run seed:admin` | Skapar eller uppdaterar administratörskontot. |
| `pnpm run seed:kiosks` | Skapar exempeldata för kiosk-enheter. |

## API i korthet

Alla `/api`-endpoints begränsas av generell rate limiting. Utöver de publika
auth-, config- och kiosk-endpointarna krävs en JWT i `Authorization`-huvudet.

| Resurs | Basadress | Åtkomst |
| --- | --- | --- |
| Hälsa | `GET /api/health` | Publik |
| Konfiguration | `GET /api/config` | Publik |
| Autentisering | `/api/auth` | Inloggning och tokenförnyelse är publika |
| Elever | `/api/students` | Inloggad; ändringar kräver administratör |
| Klasser och schema | `/api/classes`, `/api/schedules` | Inloggad, rollstyrd |
| Närvaro | `/api/attendance` | Inloggad; registrering för admin/instruktör/personal |
| Rapporter | `/api/reports`, `/api/report-presets` | Admin eller instruktör |
| Kiosker | `/api/kiosks` | Administratör |
| Kiosk-närvaro | `/api/kiosk-attendance` | Enhetsnyckel |
| Mätvärden | `GET /api/metrics` | Kräver `METRICS_TOKEN` |

Routedefinitionerna i `src/routes/` är den fullständiga och aktuella
referensen för parametrar, validering och behörighet.

## Produktion

Bygg båda apparna och sätt miljövariabler i driftmiljön. I produktion måste
frontend ha `BACKEND_URL` (eller `NEXT_PUBLIC_API_URL`) för serveranrop och
Next.js-proxyn. Kör inte med standardhemligheter eller standardlösenord.

`./scripts/start-prod.sh` är avsedd för lokal produktionslik testning. Den
bygger apparna, använder PM2 och startar backend på 4010 samt frontend på
4011. Se [AUTOSTART_SETUP.md](AUTOSTART_SETUP.md) för en generell
PM2/systemd-installation.

## Projektstruktur

```text
src/                 Express: routes, controllers, services och modeller
config/system.yaml   Kategorier och bältesgrader
frontend/            Next.js-app
scripts/             Utveckling, drift och seedning
```
