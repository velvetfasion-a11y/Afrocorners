# AfroCorner

Svensk webbutik för en liten butik med afrikanska varor: hårvård, skönhet, mat, kultur och accessoarer. Kunderna beställer utan att betala på sidan. Butiken skickar en betalningslänk via WhatsApp eller SMS. Ägaren sköter sortiment, lager och texter i `/admin`.

Utan Firebase-nycklar kör sidan i ett lokalt demiläge med färdiga varor. SumUp är valfritt. Butiken och den manuella skärmen **Sålt i butik** fungerar utan det.

## Köra lokalt

```bash
npm install
npm run dev
```

Öppna [http://127.0.0.1:43123](http://127.0.0.1:43123).

Demoläge (inget `.env.local`):

- Butiken sparas i `.data/db.json` på servern.
- Admin: `agare@afrocorner.se` / `demo1234`
- Byt lösenord med `DEMO_ADMIN_PASSWORD` innan sidan läggs ut. Demoläget är inte ett skalskydd.

```bash
npm test
npm run seed
```

`npm run seed` skriver exempeldata till Firestore när en service account är satt. Annars gör den inget, eftersom demoläget redan fyller butiken första gången.

## För butiksägaren

1. Skapa ett Firebase-projekt.
2. Slå på **Authentication → Email/Password** och skapa ett konto åt dig själv.
3. Skapa Firestore och Storage.
4. Kopiera webbnyckeln (Firebase config) till `.env.local` som `NEXT_PUBLIC_FIREBASE_*`. Se `.env.example`.
5. Skapa en service account (**Project settings → Service accounts → Generate new private key**). Lägg JSON-innehållet i `FIREBASE_SERVICE_ACCOUNT` (en rad) eller sökvägen i `FIREBASE_SERVICE_ACCOUNT_PATH`. Den filen får inte in i git.
6. I Firestore, skapa dokumentet `admins/{uid}` där `{uid}` är användarens User UID från Authentication. Innehållet kan vara `{ "role": "owner" }`. Utan det dokumentet går det inte att logga in.
7. Publicera `firestore.rules` och `storage.rules` i Firebase-konsolen.
8. Logga in på `/admin`. Första anropet lägger in exempelvaror om databasen är tom.
9. Ändra adress, öppettider, telefon (`0705508554` är startvärdet) och meddelandemallen under **Innehåll**.

Kunder kan läsa katalogen. De kan bara skapa ordrar med status `ny`. Allt annat kräver ägarkontot. SumUp-nycklar ligger i `private/sumup` eller i `.data/sumup-secrets.json`. Reglerna släpper inte in webbläsaren dit.

## Beställning

Kunden väljer hemleverans eller hämtning i Fittja eller Märsta och trycker **WhatsApp** eller **SMS**. Meddelandet går till butikens nummer i formatet `+46` (`wa.me`). På en mobil som kan dela filer följer produktbilderna med i delningen. Annars ligger bildlänkar i texten. Ordern sparas och syns under **Ordrar**.

När ordern markeras som **Skickad/Hämtad** minskar lagret. Hämtning tar från vald butik. Hemleverans tar från den butik du väljer, med Fittja som standard. Avbryts en färdig order läggs antalet tillbaka.

## Lager i butik

**Sålt i butik** är den snabba telefonvyn: välj Fittja eller Märsta (valet sparas), tryck **−1** eller ange antal. **Lager** har plus/minus och **Inleverans**. Varje ändring hamnar i **Logg** med datum, butik, vara, antal och orsak.

## SumUp

Kontroll mot [SumUps dokumentation](https://developer.sumup.com/api) (november 2026):

| Behov | API | Används |
| --- | --- | --- |
| API-nyckel, en per handlarkonto | [API keys](https://developer.sumup.com/tools/authorization/api-keys/), `Authorization: Bearer` | Ja. Nyckeln postas en gång till servern och sparas aldrig i klienten. |
| OAuth för ägaren | [Authorization code](https://developer.sumup.com/tools/authorization/oauth/) med `sales.read`, `transactions.history`, `readers.read`, `user.profile` | Ja, om `SUMUP_CLIENT_ID` och `SUMUP_CLIENT_SECRET` finns. Client credentials kan inte läsa försäljning. |
| Varurader, SKU, antal | `POST /v1.0/merchants/{code}/sales/search` och `GET /v1.0/merchants/{code}/sales/{id}` | Ja. Bara stängda, fullbetalda kvitton. Kanaler POS, SOLO och KIOSK. |
| Returer | Rad med `operation_type: RETURN`, eller transaktion `REFUNDED` / `refunded_amount` via `GET /v2.1/merchants/{code}/transactions/history?changes_since=` | Hel retur lägger tillbaka antalet. Samma `externalRef` gör omförsök ofarliga. |
| Kortläsare | `GET /v0.1/merchants/{code}/readers` | Listas så de kan kopplas, men kvittot innehåller ingen läsar-id. |
| Webhook | [Checkouts](https://developer.sumup.com/online-payments/webhooks/) `CHECKOUT_STATUS_CHANGED` | Finns på `/api/sumup/webhook?token=…`. SumUp har ingen webhook för vanliga köp i SumUp-appen. |

Så här kopplar du:

1. I [me.sumup.com](https://me.sumup.com): **Settings → For developers → Toolkit → API keys**. Skapa en hemlig nyckel. SumUp visar den bara en gång.
2. I admin under **SumUp**, klistra in nyckeln. Den sparas på servern. Gränssnittet visar bara de sista tecknen.
3. Har du två butiker, skapa **ett SumUp-konto per butik** och lägg in båda nycklarna. Koppla varje merchant code till Fittja eller Märsta.
4. Lägg samma SKU på varan i AfroCorner och i SumUps katalog (`references.sku`). Namn matchas också, utan hänsyn till stora bokstäver och å/ä/ö.
5. Sådant som inte matchar hamnar under **Omatchade varor**. Välj produkt och tryck **Koppla**.
6. **Synka nu**, eller låt Vercel Cron anropa `GET /api/sumup/sync` var tionde minut. Sätt `CRON_SECRET`. Första synken börjar vid dagens datum så gamla kvitton inte tömmer lagret.

Det här kan SumUp-API:t inte göra, och därför gör sidan det inte heller:

- Vanliga kortköp där bara ett belopp slås in (ingen vara i kassan) har inga varurader. De listas som **Kortköp utan varor** och ändrar inte lagret. Använd **Sålt i butik**.
- En delvis retur utan varurader kan inte säga vilken vara som kom tillbaka. Den listas, och lagret rättas under **Lager**.
- Försäljningen säger inte vilken kortläsare som tog betalt. Läsarkopplingen används bara om fältet dyker upp senare. Tills dess styr merchant code butiken.
- Det finns ingen push när någon betalar i SumUp-appen. Pollning är vägen. Webhooken gäller bara om du själv skapar en checkout med `return_url`.

Loggrader från SumUp har orsaken **SumUp-försäljning** eller **SumUp-retur**.

## Publicera

Vercel: importera repot, lägg in samma miljövariabler, sätt `CRON_SECRET`. `vercel.json` pollar SumUp var tionde minut.

Firebase Hosting kör inte den här Next-servern av sig själv. API, admin och SumUp-synk behöver en Node-server (Vercel eller motsvarande). Firestore och Storage används som databas när service account är satt.

## Regler i korthet

- Alla läser produkter och texter.
- Kunder får skapa en order med status `ny`.
- Bara dokumentet `admins/{uid}` får skriva katalogen.
- `private/**` är stängt för webbläsaren. Servern använder Admin SDK.
