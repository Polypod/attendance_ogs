# SSO mellan OGS och attendance_ogs

## Mål och behörighet

- En användare som är inloggad i OGS ska kunna öppna `att.minamail.se` utan att ange lösenord igen.
- SSO är opt-in per konto: endast användare som redan finns i attendance och där har **SSO aktiverat** och ett kopplat OGS-konto kan logga in via OGS. Attendance skapar aldrig konton automatiskt vid SSO-inloggning.
- Det kopplade OGS-kontot måste vara godkänt (`status === 'approved'`), inte avaktiverat (`isActive !== false`) och ha rollen `admin` eller `editor`.
- OGS-rollen är ett **tak** för rollen i attendance. Rollerna rangordnas `admin` > `editor` > `instructor` > `staff` > `student`. OGS `admin` ger taket `admin`, OGS `editor` ger taket `editor`; om båda finns gäller `admin`. Den lokala rollen sätts av en attendance-admin och kan vara lägre än taket, men aldrig högre.
- `member` utan någon av rollerna ovan nekas. Editor får inte åtkomst till Users, Settings eller deras administrativa API-operationer.
- Befintlig lösenordsinloggning i attendance behålls under migreringen och kan avvecklas separat. Minst ett lokalt admin-konto utan SSO behålls som nödåtkomst.

## Koppling mellan attendance-användare och OGS-konto

### Datamodell i attendance

Utöka `User` (`src/models/User.ts`) med ett inbäddat `sso`-objekt:

| Fält | Typ | Betydelse |
| --- | --- | --- |
| `sso.enabled` | boolean, standard `false` | SSO-inloggning tillåten för kontot. Sätts bara av admin. |
| `sso.issuer` | string | OGS-utfärdarens kanoniska URL, till exempel `https://gojuryu.se`. |
| `sso.subject` | string | OGS användar-ID (`sub`). Det enda som identifierar personen vid inloggning. |
| `sso.ogsEmail` | string | OGS-e-post vid senaste kontroll. Endast för visning. |
| `sso.ogsRoles` | string[] | OGS-roller vid senaste kontroll, till exempel `['admin']`. |
| `sso.roleCeiling` | `'admin'` \| `'editor'` \| null | Taket enligt senaste kontroll; `null` betyder att kontot inte är behörigt. |
| `sso.lastVerifiedAt` | Date | Tidpunkt då OGS senast svarade för kontot. |
| `sso.linkedAt`, `sso.linkedBy` | Date, string | När och av vilken attendance-admin kopplingen gjordes. |

- Unikt partiellt index på `(sso.issuer, sso.subject)` där `sso.subject` finns: ett OGS-konto kan bara kopplas till en attendance-användare.
- `password` blir valfritt för konton med `sso.enabled === true`. `/api/auth/login` nekar kontrollerat konton utan lösenord i stället för att anropa `bcrypt.compare` med ett tomt värde.

### Hur en admin kopplar ett konto

1. Admin öppnar användaren under **Users** i attendance och väljer **Aktivera SSO**.
2. Attendance hämtar listan över OGS-konton med `admin` eller `editor` (se *Endpoints i OGS* nedan) och visar namn, e-post och roll. Ett konto med samma e-post föreslås, men admin måste själv välja och bekräfta.
3. Admin väljer en lokal roll som inte är högre än OGS-taket; backend avvisar en högre roll. Attendance sparar `issuer`, `subject`, `roleCeiling`, `lastVerifiedAt`, `linkedAt`, `linkedBy` och sätter `enabled: true`.
4. **Koppla från** tömmer `sso`-fälten och sätter `enabled: false`. Om kontot saknar lösenord måste admin först sätta ett, annars blir kontot oanvändbart (vilket kan vara avsikten).

Användaren kan inte själv aktivera SSO eller välja vilket OGS-konto som kopplas.

### Regel vid SSO-inloggning

- Backend letar upp användaren enbart på `(issuer, sub)` från det verifierade ID-tokenet, aldrig på e-post.
- Ingen träff, `sso.enabled !== true` eller lokal `status !== 'active'` ger nekad inloggning med beskedet att kontot inte är kopplat och att en administratör behöver aktivera SSO.
- OGS-claims i ID-tokenet (roller, status) uppdaterar `sso.ogsRoles`, `sso.roleCeiling` och `sso.lastVerifiedAt`. Saknas ett tak nekas inloggningen. Den lagrade lokala rollen ändras inte.

## Kontroll mot OGS och spärr i backend

Kravet är att en ändring i OGS ska spärra en redan aktiv session inom fem minuter. En kontroll enbart vid inloggning eller när en admin ändrar användaren räcker inte: access-token gäller i 24 timmar och refresh-token i 7 dagar, och ingenting händer i attendance när OGS ändras. I stället för en schemalagd synk kontrolleras kontot **vid behov**, när det används.

### Endpoints i OGS

- `GET /api/attendance-sync/staff` listar alla användare med rollen `admin` eller `editor`: `id`, `email`, namn, `roles`, `status`, `isActive`. Används när en admin kopplar ett konto.
- `GET /api/attendance-sync/staff/:id` returnerar samma fält för en användare, eller 404. Används av kontrollen i `authenticate`.
- Samma autentisering som `/api/attendance-sync/members`: tjänsteanvändaren (`ATTENDANCE_SYNC_USER_EMAIL`) med Payload API-nyckel, eller admin. Inga andra personuppgifter returneras.

### När attendance frågar OGS

- Vid SSO-inloggning: claims i det verifierade ID-tokenet.
- När en admin kopplar eller ändrar ett SSO-konto: listan ovan.
- I `authenticate` och `AuthController.refreshToken`: om `sso.lastVerifiedAt` är äldre än 5 minuter hämtas kontot från OGS innan anropet släpps igenom. Ett konto ger alltså högst ett anrop till OGS per 5 minuter, och bara när det används. Samtidiga anrop för samma konto delar på en förfrågan, med kort timeout (cirka 3 sekunder).

En inaktiv session behöver ingen kontroll, eftersom den inte gör några anrop. Nästa anrop efter fem minuter kontrolleras alltid.

### Spärren i `authenticate`

`src/middleware/auth.ts` utökas efter den befintliga statuskontrollen. Den gäller **hela kontot**, oavsett om token kom från SSO eller lösenord, så att lösenordsinloggning inte kringgår en spärr i OGS:

- Om `sso.enabled === true` och kontrollen ger `roleCeiling === null` (rollen borttagen, `pending`, `rejected`, `isActive === false` eller kontot saknas i OGS) svarar backend 401 och sessionen avslutas.
- Om OGS inte svarar och senaste bekräftelse är äldre än 5 minuter svarar backend 401 (fail closed). Lokala konton utan SSO påverkas inte.
- Effektiv roll i `req.user.role` blir den lägsta av lagrad lokal roll och `roleCeiling`. En OGS-admin som blir editor i OGS arbetar alltså som editor i attendance utan att den lagrade rollen ändras.
- Frontend läser den effektiva rollen från `GET /api/auth/me`, inte från rollen som lades i NextAuth-sessionen vid inloggningen, så att menyn följer taket.

## Föreslaget inloggningsflöde

1. Lägg till en OIDC-identitetsutfärdare kopplad till OGS befintliga Payload-session. Det är ny funktionalitet: Payload-konfigurationen i OGS är inte i dag en OIDC-utfärdare.
2. Attendance initierar OpenID Connect Authorization Code Flow med PKCE och skickar webbläsaren till OGS. OGS ser sin egen inloggningscookie och kontrollerar aktuell användare, `status === 'approved'`, `isActive !== false` samt `roles`. Är användaren inte inloggad visas OGS inloggning med en validerad återgångs-URL.
3. OGS utfärdar en kortlivad engångskod till en registrerad callback-URL. NextAuth byter koden server-till-server mot ett signerat ID-token och validerar `iss`, `aud`, `exp`, `nonce`, signatur och `state`.
4. NextAuth skickar ID-tokenet till ett nytt backend-endpoint (`POST /api/auth/sso`). Backend verifierar själv tokenet mot OGS JWKS, tillämpar *Regel vid SSO-inloggning* och utfärdar attendance-API-token.
5. Webbläsaren får aldrig själv tilldela sig roll eller identitet.

## Arbete i OGS

- Välj en etablerad OIDC-serverkomponent och undvik ett egenbyggt tokenprotokoll. `oidc-provider` är Koa-baserad och passar inte direkt i Next.js route handlers; ett realistiskt alternativ är en separat Node-process bakom Caddy på utfärdarens domän som läser inloggad användare via Payloads `GET /api/users/me` med cookien. Det tekniska provet ska bekräfta valet.
- Authorize-endpointen godtar endast cookie-sessionen, inte API-nycklar, så att tjänsteanvändare aldrig blir SSO-identiteter.
- Registrera attendance som klient med strikt tillåtna callback-URL:er, klient-ID och separata nycklar per miljö. Exponera discovery, JWKS, authorize- och token-endpoints enligt OIDC.
- Kontrollera roller och kontostatus när auktoriseringskoden skapas och när den byts mot token. Koden ska vara engångsbruk, kortlivad och bunden till klient, redirect-URI och PKCE.
- Lägg till `GET /api/attendance-sync/staff` och `GET /api/attendance-sync/staff/:id` enligt ovan.
- Välj en kanonisk domän för utfärdaren. Caddy serverar samma app på `gojuryu.se` och `dojo.gojuryu.se`, och Payload-cookien gäller bara den domän den sattes på.

## Arbete i attendance_ogs

- Lägg till en OIDC-provider i `frontend/src/lib/authOptions.ts` (`checks: ['pkce', 'state', 'nonce']`) och knappen **Logga in med OGS** på inloggningssidan.
- Utöka `User` med `sso`-objektet, indexet och valfritt lösenord enligt *Datamodell i attendance*.
- Lägg till `POST /api/auth/sso` och koppling och frånkoppling i Users-vyn (endast admin), med kontroll av att vald roll inte överstiger taket.
- Lägg in kontrollen mot OGS, spärren och den effektiva rollen i `authenticate` och `refreshToken`.
- Håll refresh-token borta från webbläsarens sessionsobjekt: i dag lägger `session()` både `accessToken` och `refreshToken` där.
- Behåll backendens adminskydd för `/api/users`, kioskhantering, medlemsynk och studentimport/export.

## Miljöer och driftsättning

- Produktion: OGS på `https://gojuryu.se` är utfärdare; attendance på `https://att.minamail.se` är klient.
- Test: OGS på `https://ogs.minamail.se` använder en separat issuer, klient, nycklar och en egen attendance-testmiljö. Eftersom länkningen sparar `issuer` kan en testidentitet aldrig matcha ett produktionskonto.
- Genomför först ett tekniskt prov av OGS-session → OIDC-kod → NextAuth-callback → backend-token. Därefter kontroll mot OGS, koppling av konton, behörighetstester och stegvis aktivering per konto.

## Godkännandekriterier

- En attendance-användare med aktiverat och kopplat SSO, som är `admin` eller `editor` i OGS, loggar in utan nytt lösenord och arbetar med sin lokala roll.
- Den effektiva rollen överstiger aldrig OGS-taket, och en admin kan inte spara en lokal roll som är högre än taket.
- En OGS-användare utan kopplat attendance-konto, eller med `sso.enabled === false`, nekas och inget konto skapas.
- `member`, `pending`, `rejected` och `isActive === false` i OGS nekas.
- Två personer med samma e-postadress blandas aldrig ihop: inloggning matchar enbart `(issuer, sub)`.
- Ett OGS-konto kan inte kopplas till två attendance-användare.
- Editor kan inte läsa Users eller Settings via meny, direkt URL eller administrativa API:er; admin kan fortfarande använda dem.
- Rollborttagning eller avaktivering i OGS spärrar en redan aktiv attendance-session inom fem minuter, även om kontot loggade in med lösenord.
- När OGS inte svarar spärras SSO-konton efter fem minuter medan lokala konton utan SSO fungerar.
- En kod kan bara användas en gång och kan inte återanvändas mot en annan klient eller miljö.
