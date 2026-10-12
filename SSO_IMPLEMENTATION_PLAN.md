# SSO mellan OGS och attendance_ogs

## Mål och behörighet

- En användare som är inloggad i OGS ska kunna öppna `att.minamail.se` utan att ange lösenord igen.
- Endast aktiva, godkända OGS-användare med `admin` eller `editor` får en attendance-session.
- `admin` i OGS blir `admin` i attendance; `editor` blir `editor`. Om båda finns har `admin` företräde.
- `member` utan någon av rollerna ovan nekas. Editor får inte åtkomst till Users, Settings eller deras administrativa API-operationer.
- Befintlig lösenordsinloggning i attendance behålls under migreringen och kan avvecklas separat.

## Föreslaget flöde

1. Lägg till en OIDC-identitetsutfärdare kopplad till OGS befintliga Payload-session. Det är ny funktionalitet: Payload-konfigurationen i OGS är inte i dag en OIDC-utfärdare.
2. Attendance initierar OpenID Connect Authorization Code Flow med PKCE och skickar webbläsaren till OGS. OGS ser sin egen inloggningscookie på sin domän och kontrollerar aktuell användare, `status === 'approved'`, `isActive !== false` samt `roles`.
3. OGS utfärdar en kortlivad engångskod till en registrerad callback-URL. Attendance byter koden server-till-server mot ett signerat ID-token och validerar `iss`, `aud`, `exp`, `nonce`, signatur och `state`.
4. Attendance länkar identiteten med `(issuer, sub)`, där `sub` är OGS användar-ID. E-post används för visning och eventuell manuell migrering, aldrig som ensam grund för automatisk kontolänkning.
5. Attendance skapar eller uppdaterar ett lokalt användarkonto med rätt roll, utfärdar sin egen API-session och lägger den i NextAuth-sessionen. Rollen hämtas från OGS vid varje ny SSO-inloggning.

## Arbete i OGS

- Välj en etablerad OIDC-serverkomponent eller tjänst som kan använda OGS Payload-session som inloggningskälla. Undvik ett egenbyggt tokenprotokoll.
- Registrera attendance som klient med strikt tillåtna callback-URL:er, klient-ID och separata nycklar per miljö. Exponera discovery, JWKS, authorize- och token-endpoints enligt OIDC.
- Kontrollera roller och kontostatus när auktoriseringskoden skapas och när den byts mot token. Koden ska vara engångsbruk, kortlivad och bunden till klient, redirect-URI och PKCE.
- Exponera ett säkert sätt för attendance att kontrollera aktuell roll och status för redan inloggade användare, till exempel kortlivade token med serverbaserad förnyelse.

## Arbete i attendance_ogs

- Lägg till en OIDC-provider i `frontend/src/lib/authOptions.ts` och knappen **Logga in med OGS** på inloggningssidan.
- Utöka backendens användarmodell med en unik extern identitet `(issuer, sub)`. Stöd SSO-konton utan lokalt lösenord; befintliga konton länkas först efter verifierad migrering.
- Lägg till ett internt, autentiserat backendflöde som tar emot en verifierad OGS-identitet, kontrollerar tillåten roll, synkar den lokala rollen och utfärdar attendance-API-token. Browserklienten får aldrig själv tilldela sig roll.
- Anpassa NextAuth:s JWT/session och API-tokenförnyelse så att en borttagen OGS-roll eller ett avaktiverat konto spärras inom högst fem minuter. Långlivade attendance-refresh-token får inte kringgå kontrollen. Håll refresh-token borta från webbläsarens sessionsobjekt.
- Behåll backendens adminskydd för `/api/users`, kioskhantering, medlemsynk och studentimport/export. Verifiera att editor kan använda övriga avsedda sidor och API:er.

## Miljöer och driftsättning

- Produktion: OGS på `https://gojuryu.se` är utfärdare; attendance på `https://att.minamail.se` är klient.
- Test: OGS på `https://ogs.minamail.se` använder en separat issuer, klient, nycklar och attendance-testmiljö. Testidentiteter får inte logga in på produktions-attendance.
- Genomför först ett tekniskt prov av OGS-session → OIDC-kod → NextAuth-callback → backend-token. Därefter kontomigrering, behörighetstester och stegvis aktivering.

## Godkännandekriterier

- OGS `admin` respektive `editor` kan logga in i attendance utan nytt lösenord och får korrekt lokal roll.
- `member`, `pending`, `rejected` och `isActive === false` nekas.
- Editor kan inte läsa Users eller Settings via meny, direkt URL eller administrativa API:er; admin kan fortfarande använda dem.
- Rollborttagning och avaktivering slår igenom inom fem minuter, även för en redan aktiv attendance-session.
- En kod kan bara användas en gång och kan inte återanvändas mot en annan klient eller miljö.
- Befintliga attendance-konton länkas utan att sammanblanda personer som råkar ha samma e-postadress.
