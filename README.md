# AfroCorner

Svensk webbutik för en liten butik med afrikanska varor: hårvård, skönhet, mat, kultur och accessoarer. Kunderna beställer utan att betala på sidan. Butiken skickar en betalningslänk via WhatsApp eller SMS. Ägaren sköter sortiment, lager och texter i `/admin`.

Utan Firebase-nycklar kör sidan i ett lokalt demiläge med färdiga varor. SumUp är valfritt. Butiken och den manuella skärmen **Sålt i butik** fungerar utan det.

## Köra lokalt

```bash
npm install
npm run dev
```

Öppna [http://127.0.0.1:43123](http://127.0.0.1:43123).

Demoläge (Firebase är inte ifyllt):

- Butiken sparas i `.data/db.json` på servern. På Vercel, utan Firebase, skrivs samma fil till `/tmp/afrocorner` och försvinner när instansen startar om.
- `/admin` visar en tydlig lokal förhandsvisning och en knapp, utan lösenord och utan Google.
- I produktion är den knappen avstängd. Sätt `ALLOW_DEMO_ADMIN=1` bara om en medveten förhandsvisning ska ha den.
- Så fort Firebase är påslaget gäller bara Google plus åtkomstkod. Demoknappen fungerar inte då.

```bash
npm test
npm run seed
```

`npm run seed` skriver exempeldata till Firestore när en service account är satt. Annars gör den inget, eftersom demoläget redan fyller butiken första gången.

## Admin-inloggning

Inloggningen har två steg, båda kontrolleras på servern. Sessionen är en signerad cookie (`HttpOnly`, `SameSite=Lax`, `Secure` i produktion) som gäller i 8 timmar. Den skapas först när båda stegen gått igenom. Utan den cookien svarar admin-sidor och API med att man ska logga in igen.

1. **Logga in med Google.** Bara Googles inloggning. E-post och lösenord finns inte. Kontot måste ha verifierad e-post.
2. **Åtkomstkod.** Koden ligger bara som ett scrypt-hash i `ADMIN_ACCESS_CODE_HASH`. Fel kod fem gånger låser i 15 minuter, per konto och per IP.

Just nu finns ett admin-konto: utvecklaren Julia. Hennes Google-adress sätts vid deploy, inte i koden:

```bash
ADMIN_EMAILS=julia@example.com:developer
```

Byt ut adressen mot Julias riktiga Google-konto. Rollen `developer` når även `/admin/dev`. En senare ägare kan läggas till som `owner`.

### Lägga till eller ta bort ett Google-konto

Lägg till: sätt `ADMIN_EMAILS` till en kommaseparerad lista, till exempel `julia@example.com:developer, agare@example.com:owner`, och starta om servern. Personen loggar in med Google och koden. Efter en lyckad inloggning skriver servern `admins/{uid}` med samma e-post och roll, så Firestore-reglerna följer med.

Ta bort: stryk adressen ur `ADMIN_EMAILS` och starta om. Radera också dokumentet `admins/{uid}` i Firestore, annars kan det kontot fortfarande skriva direkt mot databasen. Befintliga cookies dör senast efter 8 timmar.

Om `ADMIN_EMAILS` är tom används bara dokumenten i `admins`. Med listan ifylld räcker det inte att finnas i Firestore: adressen måste stå i miljön.

### Skapa hashet för åtkomstkoden

Kör lokalt. Koden sparas inte och ska inte in i git, och inte hashet heller.

```bash
npm run hash-access-code
```

Klistra in raden som skrivs ut i värdens `ADMIN_ACCESS_CODE_HASH`. Saknas hashet när Firebase är påslaget går det inte att logga in.

### Firebase

1. Skapa ett Firebase-projekt. Slå på **Authentication → Google**. E-post/lösenord ska vara av.
2. Lägg webbnyckeln i `NEXT_PUBLIC_FIREBASE_*`.
3. Lägg service account i `FIREBASE_SERVICE_ACCOUNT` eller `FIREBASE_SERVICE_ACCOUNT_PATH`.
4. Publicera `firestore.rules` och `storage.rules`. De kräver Google, `email_verified`, och att `admins/{uid}` har samma e-post och rollen `owner` eller `developer`.
5. Sätt `ADMIN_EMAILS` och `ADMIN_ACCESS_CODE_HASH`.

Kunder kan läsa katalogen och skapa ordrar med status `ny`. Allt annat kräver den korta sessionen.

## Beställning

Kunden väljer hemleverans eller hämtning i Fittja eller Märsta och trycker **WhatsApp** eller **SMS**. Meddelandet går till butikens nummer i formatet `+46` (`wa.me`). På en mobil som kan dela filer följer produktbilderna med i delningen. Annars ligger bildlänkar i texten. Ordern sparas och syns under **Ordrar**.

När ordern markeras som **Skickad/Hämtad** minskar lagret. Hämtning tar från vald butik. Hemleverans tar från den butik du väljer, med Fittja som standard. Avbryts en färdig order läggs antalet tillbaka.

## Lager i butik

**Sålt i butik** är den snabba telefonvyn: välj Fittja eller Märsta (valet sparas), tryck **−1** eller ange antal. **Lager** har plus/minus och **Inleverans**. Varje ändring hamnar i **Logg** med datum, butik, vara, antal och orsak.

## SumUp (för oss som sätter upp, inte för ägaren)

Ägaren ser inte SumUp i admin. Hon ser bara lagerändringar med orsaken **SumUp-försäljning** eller **SumUp-retur**, och raden "Kassan synkas automatiskt" när nycklarna är satta.

Kontroll mot [SumUps dokumentation](https://developer.sumup.com/api) (november 2026):

| Behov | API | Används |
| --- | --- | --- |
| API-nyckel, en per handlarkonto | [API keys](https://developer.sumup.com/tools/authorization/api-keys/), `Authorization: Bearer` | Ja. Nyckeln postas en gång till servern och sparas aldrig i klienten. |
| OAuth för ägaren | [Authorization code](https://developer.sumup.com/tools/authorization/oauth/) med `sales.read`, `transactions.history`, `readers.read`, `user.profile` | Ja, om `SUMUP_CLIENT_ID` och `SUMUP_CLIENT_SECRET` finns. Client credentials kan inte läsa försäljning. |
| Varurader, SKU, antal | `POST /v1.0/merchants/{code}/sales/search` och `GET /v1.0/merchants/{code}/sales/{id}` | Ja. Bara stängda, fullbetalda kvitton. Kanaler POS, SOLO och KIOSK. |
| Returer | Rad med `operation_type: RETURN`, eller transaktion `REFUNDED` / `refunded_amount` via `GET /v2.1/merchants/{code}/transactions/history?changes_since=` | Hel retur lägger tillbaka antalet. Samma `externalRef` gör omförsök ofarliga. |
| Kortläsare | `GET /v0.1/merchants/{code}/readers` | Listas så de kan kopplas, men kvittot innehåller ingen läsar-id. |
| Webhook | [Checkouts](https://developer.sumup.com/online-payments/webhooks/) `CHECKOUT_STATUS_CHANGED` | Finns på `/api/sumup/webhook?token=…`. SumUp har ingen webhook för vanliga köp i SumUp-appen. |

Så här kopplar vi (inte ägaren):

1. I [me.sumup.com](https://me.sumup.com): **Settings → For developers → Toolkit → API keys**. Skapa en hemlig nyckel per butik. SumUp visar den bara en gång.
2. Sätt `SUMUP_FITTJA_API_KEY` och `SUMUP_FITTJA_MERCHANT_CODE`, och samma par för Märsta. Nycklarna läses bara på servern.
3. Lägg samma SKU på varan i AfroCorner och i SumUps katalog. Namn matchas också. Omatchade rader syns på `/admin/dev` för kontot med rollen developer, inte i ägarens admin.
4. Sätt `CRON_SECRET`. Vercel anropar `GET /api/sumup/sync` en gång per dygn, kl. 03:00 UTC (`0 3 * * *`). Hobby-planen tillåter bara dagliga cron-jobb.

Det här kan SumUp-API:t inte göra, och därför gör sidan det inte heller:

- Vanliga kortköp där bara ett belopp slås in (ingen vara i kassan) har inga varurader. De listas som **Kortköp utan varor** och ändrar inte lagret. Använd **Sålt i butik**.
- En delvis retur utan varurader kan inte säga vilken vara som kom tillbaka. Den listas, och lagret rättas under **Lager**.
- Försäljningen säger inte vilken kortläsare som tog betalt. Läsarkopplingen används bara om fältet dyker upp senare. Tills dess styr merchant code butiken.
- Det finns ingen push när någon betalar i SumUp-appen. Pollning är vägen. Webhooken gäller bara om du själv skapar en checkout med `return_url`.

Loggrader från SumUp har orsaken **SumUp-försäljning** eller **SumUp-retur**.

## Publicera

Vercel: importera repot, lägg in samma miljövariabler, sätt `CRON_SECRET`. `vercel.json` pollar SumUp en gång per dygn (`0 3 * * *`, 03:00 UTC). Hobby-planen tillåter inte ett jobb var tionde minut.

Firebase Hosting kör inte den här Next-servern av sig själv. API, admin och SumUp-synk behöver en Node-server (Vercel eller motsvarande). Firestore och Storage används som databas när service account är satt.

## Regler i korthet

- Alla läser produkter och texter.
- Kunder får skapa en order med status `ny`.
- Bara dokumentet `admins/{uid}` får skriva katalogen.
- `private/**` är stängt för webbläsaren. Servern använder Admin SDK.
