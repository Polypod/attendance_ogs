# Automatisk start med PM2 och systemd

Den här guiden beskriver en generell installation. Den tidigare
maskinspecifika statusrapporten och absoluta sökvägarna är medvetet borttagna:
de kan inte användas som instruktion för andra installationer.

## Förberedelser

1. Bygg backend och frontend från projektets rot:

   ```bash
   pnpm install
   pnpm --dir frontend install
   pnpm run build
   BACKEND_URL=http://127.0.0.1:4010 pnpm -C frontend run build
   ```

2. Installera PM2 för driftanvändaren och skapa en egen
   `ecosystem.config.js` med rätt sökvägar, domän, hemligheter och backend-URL.
   Den inkluderade filen innehåller exempelvärden från en specifik server och
   ska inte användas direkt utan granskning.

3. Kontrollera att backendens produktionsmiljö har `MONGODB_URI`,
   `JWT_SECRET`, `JWT_REFRESH_SECRET` och `FRONTEND_URL`, och att frontendens
   miljö har `NEXTAUTH_URL`, `NEXTAUTH_SECRET` och `BACKEND_URL`.

## Start och kontroll

```bash
pm2 start ecosystem.config.js --env production
pm2 status
pm2 logs
```

Verifiera att hälsokontrollen svarar innan autostart aktiveras:

```bash
curl --fail http://127.0.0.1:4010/api/health
```

## Aktivera vid omstart

Använd PM2:s installationskommando för den driftanvändare som ska äga
processerna och följ instruktionerna som kommandot skriver ut:

```bash
pm2 startup
pm2 save
```

Systemtjänsten och användarens hemkatalog är miljöspecifika. Granska
genererad systemd-konfiguration, ägarskap, miljövariabler och loggkataloger
innan tjänsten aktiveras.

## Drift

```bash
pm2 status
pm2 logs backend
pm2 logs frontend
pm2 restart backend
pm2 restart frontend
```

Konfigurera loggrotation för PM2-loggar. Projektet innehåller
`scripts/setup-pm2-logrotate.sh`, som kan användas när PM2 och dess
behörigheter är korrekt installerade.
