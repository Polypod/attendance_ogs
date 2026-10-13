# SSO mellan OGS och attendance_ogs

## Mål och behörighet

- En användare som är inloggad i OGS ska kunna öppna `att.minamail.se` utan att ange lösenord igen.
- Endast godkända OGS-användare med `admin` eller `editor` får en attendance-session. `isActive` spärrar bara när värdet är `false`; admin och editor utan värde släpps igenom.
- Kontot måste dessutom vara manuellt länkat av en admin i attendance och ha SSO aktiverat för just den användaren (kryssruta per användare).
- `admin` i OGS blir `admin` i attendance; `editor` blir `editor`. Om båda finns har `admin` företräde.
- `member` utan någon av rollerna ovan nekas. Editor får inte åtkomst till Users, Settings eller deras administrativa API-operationer.
- Befintlig lösenordsinloggning i attendance behålls under migreringen och kan avvecklas separat.

## Beslut

| Fråga | Beslut |
| --- | --- |
| OIDC-utfärdare | `node-oidc-provider` inbyggd i OGS (Next.js/Payload), med Payload-sessionen som inloggningskälla |
| Issuer-URL | `https://gojuryu.se/api/oidc` i produktion, `https://ogs.minamail.se/api/oidc` i test. Värdet sparas i varje kontolänk och får inte ändras i efterhand |
| Kontroll av roll och status | Ny endpoint `GET /api/attendance-sync/staff` i OGS, skyddad med samma tjänsteanvändare som medlemssynken. Medlemsexporten används inte, eftersom allt i den blir elever i attendance |
| Next-servern mot backenden | Backenden verifierar själv ID-token från OGS mot OGS JWKS (`iss`, `aud`, ålder, signatur) och tar emot varje token en gång. Därutöver krävs `SSO_INTERNAL_SECRET` i headern `X-Internal-Secret` |
| Kontolänkning | Admin länkar manuellt i Users och aktiverar SSO med en kryssruta per användare. Ingen automatisk kontoskapning och ingen matchning på e-post |
| `isActive` saknas | Admin och editor släpps igenom |
| Utloggning | Ingen gemensam utloggning; sessionen löper ut |
| Testmiljö | Produktions-attendance litar bara på `https://gojuryu.se`. Tekniskt prov mot `https://ogs.minamail.se` görs lokalt eller i en tillfällig instans |

## Flöde

1. Lägg till en OIDC-identitetsutfärdare kopplad till OGS befintliga Payload-session. Det är ny funktionalitet: Payload-konfigurationen i OGS är inte i dag en OIDC-utfärdare.
2. Attendance initierar OpenID Connect Authorization Code Flow med PKCE och skickar webbläsaren till OGS. OGS ser sin egen inloggningscookie på sin domän och kontrollerar aktuell användare, `status === 'approved'`, `isActive !== false` samt `roles`.
3. OGS utfärdar en kortlivad engångskod till en registrerad callback-URL. Attendance byter koden server-till-server mot ett signerat ID-token och validerar `iss`, `aud`, `exp`, `nonce`, signatur och `state`.
4. Attendance slår upp användaren på `(issuer, sub)`, där `sub` är OGS användar-ID och länken har satts av en admin. E-post används aldrig för att hitta eller länka konton.
5. Attendance kräver att SSO är aktiverat för användaren, hämtar aktuell roll från OGS staff-endpoint, synkar den lokala rollen och utfärdar sin egen API-session med ett access-token på 5 minuter. Varje förnyelse kontrollerar OGS igen.

## Arbete i OGS

- [x] `GET /api/attendance-sync/staff[?id=]` exporterar admin- och editorkonton (`id`, `email`, `displayName`, `roles`, `status`, `isActive`).
- [x] `oidc-provider` på `/api/oidc` med Payload-sessionen som inloggningskälla. Interaktionen körs vid varje inloggning och släpper bara igenom godkända admin- och editorkonton som inte är inaktiva; kontot kontrolleras igen när koden byts mot token. Koder gäller 60 sekunder och en gång, PKCE krävs. Nycklar och klienthemlighet genereras med `node scripts/generate-oidc-config.mjs <OGS-URL> <attendance-URL>` i OGS.
- Registrera attendance som klient med strikt tillåtna callback-URL:er, klient-ID och separata nycklar per miljö. Exponera discovery, JWKS, authorize- och token-endpoints enligt OIDC.
- Kontrollera roller och kontostatus när auktoriseringskoden skapas och när den byts mot token. Koden ska vara engångsbruk, kortlivad och bunden till klient, redirect-URI och PKCE.
- Exponera ett säkert sätt för attendance att kontrollera aktuell roll och status för redan inloggade användare, till exempel kortlivade token med serverbaserad förnyelse.

## Arbete i attendance_ogs

- [x] OIDC-provider `ogs` i `frontend/src/lib/authOptions.ts` (PKCE, state, nonce) och knappen **Logga in med OGS** på inloggningssidan. Båda visas bara när `OGS_OIDC_*` är satta.
- [x] Användarmodellen har en unik extern identitet `(issuer, sub)` och `sso_enabled`. SSO-konton kan sakna lokalt lösenord.
- [x] Admin länkar OGS-konto och kryssar i SSO under Users; listan hämtas från OGS staff-endpoint.
- [x] `POST /api/auth/sso/ogs` verifierar ID-token, kräver länkat konto med SSO aktiverat, hämtar roll från OGS och utfärdar attendance-token. Browserklienten kan aldrig tilldela sig en roll.
- [x] Access-token för SSO gäller 5 minuter. NextAuth förnyar det på servern och varje förnyelse kontrollerar OGS, så en borttagen roll eller ett avaktiverat konto spärras inom cirka fem minuter. Om OGS inte svarar nekas åtkomst. Refresh-token ligger bara i den krypterade JWT-cookien, inte i webbläsarens sessionsobjekt.
- [ ] Behåll backendens adminskydd för `/api/users`, kioskhantering, medlemsynk och studentimport/export. Verifiera att editor kan använda övriga avsedda sidor och API:er.

## Miljöer och driftsättning

- Produktion: OGS på `https://gojuryu.se` är utfärdare; attendance på `https://att.minamail.se` är klient.
- Test: OGS på `https://ogs.minamail.se` använder en separat issuer, klient och nycklar. Det finns ingen separat attendance-testserver, så provet körs lokalt eller i en tillfällig instans. Produktions-attendance konfigureras bara med produktionens issuer, så testidentiteter kan inte logga in där.
- Genomför först ett tekniskt prov av OGS-session → OIDC-kod → NextAuth-callback → backend-token. Därefter kontomigrering, behörighetstester och stegvis aktivering.

## Godkännandekriterier

- OGS `admin` respektive `editor` kan logga in i attendance utan nytt lösenord och får korrekt lokal roll.
- `member`, `pending`, `rejected` och `isActive === false` nekas.
- Editor kan inte läsa Users eller Settings via meny, direkt URL eller administrativa API:er; admin kan fortfarande använda dem.
- Rollborttagning och avaktivering slår igenom inom fem minuter, även för en redan aktiv attendance-session.
- En kod kan bara användas en gång och kan inte återanvändas mot en annan klient eller miljö.
- Befintliga attendance-konton länkas utan att sammanblanda personer som råkar ha samma e-postadress.
