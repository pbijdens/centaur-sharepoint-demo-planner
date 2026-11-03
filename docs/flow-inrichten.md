# Power Automate-flow inrichten (e-mailintake)

Deze flow zet elke nieuwe e-mail in de gedeelde mailbox om in een **Bericht** en koppelt dat aan een bestaande of nieuwe **Aanvraag** (UC-01, FR-01 t/m FR-07). De flow gebruikt alleen standaardconnectoren (Office 365 Outlook en SharePoint), dus een premiumlicentie is niet nodig.

> De naam van de afzender en de link naar Outlook vult de **app** later aan via Graph, zodra een agent de aanvraag opent. De trigger levert alleen het adres, dus de flow houdt het bewust eenvoudig.

## Voorbereiding

- Het flow-account heeft **Volledige toegang** op de gedeelde mailbox en is lid van het team / de site ([rechten-toekennen.md](rechten-toekennen.md), stap 4).
- De lijsten bestaan al: open de app één keer als site-eigenaar (FR-81).
- Maak de flow bij voorkeur in een **oplossing** (Power Automate → Oplossingen → Nieuwe oplossing), zodat je de flow kunt exporteren en voor een ander team opnieuw kunt gebruiken.

### Omgevingsvariabelen (FR-07)

Maak in de oplossing twee omgevingsvariabelen van het type *Tekst*:

| Naam | Voorbeeld |
|---|---|
| `MailboxAdres` | `halplanning@centaur.nl` |
| `SiteUrl` | `https://centaur.sharepoint.com/sites/Halplanning` |

Gebruik deze variabelen overal waar hieronder het mailboxadres of het siteadres staat.

## De flow, stap voor stap

Hieronder staat **`T`** voor de uitvoer van de trigger (`triggerOutputs()?['body/...']`).

### 1. Trigger: *Wanneer er een nieuwe e-mail binnenkomt in een gedeelde mailbox (V2)*

| Veld | Waarde |
|---|---|
| Oorspronkelijk postvakadres | `MailboxAdres` |
| Map | Postvak IN |
| Bijlagen opnemen | Nee |

**Instellingen van de trigger → Gelijktijdigheidsbeheer: aan, mate van parallelle uitvoering 1.** Zo kunnen twee snel opeenvolgende mails van dezelfde afzender niet elk een eigen nieuwe aanvraag maken.

### 2. Variabele initialiseren

- Naam: `AanvraagId`, type *Geheel getal*, waarde `0`.

### 3. Dubbele verwerking voorkomen (FR-01)

**SharePoint – Items ophalen**, hernoemen naar `Bestaand_bericht`:

| Veld | Waarde |
|---|---|
| Siteadres | `SiteUrl` |
| Lijstnaam | `Berichten` (aangepaste waarde) |
| Filterquery | `InternetMessageId eq '@{replace(triggerOutputs()?['body/internetMessageId'], '''', '''''')}'` |
| Maximum aantal | `1` |

**Voorwaarde**: `length(body('Bestaand_bericht')?['value'])` *is groter dan* `0`
- **Ja** → *Beëindigen*, status *Geslaagd*.

### 4. Koppelregel 1: dezelfde conversatie (FR-02)

**SharePoint – Items ophalen**, hernoemen naar `Berichten_in_conversatie`:

| Veld | Waarde |
|---|---|
| Lijstnaam | `Berichten` |
| Filterquery | `ConversationId eq '@{replace(triggerOutputs()?['body/conversationId'], '''', '''''')}'` |
| Maximum aantal | `50` |

**Voorwaarde**: `length(body('Berichten_in_conversatie')?['value'])` *is groter dan* `0`

- **Ja**:
  1. **Gegevensbewerking – Selecteren**, hernoemen naar `Aanvraag_filters`:
     - Van: `body('Berichten_in_conversatie')?['value']`
     - Toewijzen (tekstmodus, via het schakelaartje rechts): `concat('Id eq ', item()?['Aanvraag']?['Id'])`
  2. **SharePoint – Items ophalen**, hernoemen naar `Open_aanvraag_conversatie`:
     - Lijstnaam: `Aanvragen`
     - Filterquery: `(@{join(body('Aanvraag_filters'), ' or ')}) and (Status eq 'Nieuw' or Status eq 'In afwachting' or Status eq 'Bevestigd' or Status eq 'Klaar voor facturatie')`
     - Sorteren op: `LaatsteBerichtOp desc`
     - Maximum aantal: `1`
  3. **Voorwaarde**: `length(body('Open_aanvraag_conversatie')?['value'])` *is groter dan* `0`
     - **Ja** → *Variabele instellen* `AanvraagId` = `first(body('Open_aanvraag_conversatie')?['value'])?['ID']`

### 5. Koppelregel 2: dezelfde afzender met een open aanvraag (FR-02)

**Voorwaarde**: `variables('AanvraagId')` *is gelijk aan* `0`

- **Ja**:
  1. **SharePoint – Items ophalen**, hernoemen naar `Open_aanvraag_afzender`:
     - Lijstnaam: `Aanvragen`
     - Filterquery: `Email eq '@{replace(triggerOutputs()?['body/from'], '''', '''''')}' and (Status eq 'Nieuw' or Status eq 'In afwachting' or Status eq 'Bevestigd' or Status eq 'Klaar voor facturatie')`
     - Sorteren op: `LaatsteBerichtOp desc`
     - Maximum aantal: `1`
  2. **Voorwaarde**: `length(body('Open_aanvraag_afzender')?['value'])` *is groter dan* `0`
     - **Ja** → *Variabele instellen* `AanvraagId` = `first(body('Open_aanvraag_afzender')?['value'])?['ID']`

### 6. Koppelregel 3: nieuwe aanvraag (FR-02, FR-06)

**Voorwaarde**: `variables('AanvraagId')` *is gelijk aan* `0`

- **Ja**:
  1. **SharePoint – Item maken**, hernoemen naar `Nieuwe_aanvraag`, lijst `Aanvragen`:

     | Kolom | Waarde |
     |---|---|
     | Titel | `T/from` |
     | Naam | `T/from` |
     | E-mailadres | `T/from` |
     | Status | `Nieuw` |
     | Onbeantwoord | `Ja` |
     | Laatste bericht op | `T/receivedDateTime` |
     | Bron | `E-mail` |

  2. *Variabele instellen* `AanvraagId` = `body('Nieuwe_aanvraag')?['ID']`

### 7. Bericht vastleggen (FR-04)

**SharePoint – Item maken**, lijst `Berichten`:

| Kolom | Waarde (expressie) |
|---|---|
| Onderwerp | `substring(coalesce(triggerOutputs()?['body/subject'], '(geen onderwerp)'), 0, min(255, length(coalesce(triggerOutputs()?['body/subject'], '(geen onderwerp)'))))` |
| Aanvraag (Id) | `variables('AanvraagId')` |
| Richting | `Inkomend` |
| Van (naam) | `T/from` |
| Van (adres) | `T/from` |
| Aan | `T/toRecipients` |
| Cc | `T/ccRecipients` |
| Ontvangen op | `T/receivedDateTime` |
| Inhoud | zie hieronder |
| Conversatie-id | `T/conversationId` |
| Internet-bericht-id | `T/internetMessageId` |
| Graph-bericht-id | `T/id` |
| Heeft bijlagen | `T/hasAttachments` |

Expressie voor **Inhoud**. Een kolom met meerdere regels tekst houdt maximaal ongeveer 63.000 tekens, dus heel lange mails (nieuwsbrieven) worden afgekapt:

```
if(greater(length(triggerOutputs()?['body/body']), 60000),
   substring(triggerOutputs()?['body/body'], 0, 60000),
   triggerOutputs()?['body/body'])
```

### 8. Aanvraag bijwerken (FR-05)

Gebruik **SharePoint – Een HTTP-aanvraag naar SharePoint verzenden**. De actie *Item bijwerken* vraagt om alle verplichte kolommen; deze actie werkt alleen de twee velden bij die moeten veranderen.

| Veld | Waarde |
|---|---|
| Siteadres | `SiteUrl` |
| Methode | `POST` |
| URI | `_api/web/lists/getbytitle('Aanvragen')/items(@{variables('AanvraagId')})` |
| Headers | `Content-Type`: `application/json;odata=nometadata` · `IF-MATCH`: `*` · `X-HTTP-Method`: `MERGE` |
| Hoofdtekst | zie hieronder |

```json
{
  "LaatsteBerichtOp": "@{triggerOutputs()?['body/receivedDateTime']}",
  "Onbeantwoord": true
}
```

## Testen

1. Stuur vanaf een extern adres een mail naar de gedeelde mailbox. Er komt een nieuwe aanvraag met status *Nieuw*.
2. Beantwoord die mail vanuit de app, en antwoord daarop vanaf het externe adres. Het antwoord komt bij dezelfde aanvraag (koppelregel 1).
3. Stuur een nieuwe mail (geen antwoord) vanaf hetzelfde externe adres. Ook die komt bij dezelfde aanvraag (koppelregel 2).
4. Zet de aanvraag op *Gesloten* en stuur opnieuw een mail. Er ontstaat een nieuwe aanvraag (FR-03).
5. Start in Power Automate een mislukte of geslaagde run opnieuw. Er ontstaat geen dubbel bericht (stap 3).

## Foutafhandeling

- Power Automate mailt de eigenaar van de flow standaard bij mislukte runs.
- Runs kunnen veilig opnieuw worden gestart; stap 3 voorkomt dubbele berichten.
- De kolom *Internet-bericht-id* is uniek. Als twee runs tegelijk hetzelfde bericht verwerken, faalt de tweede bij stap 7, zonder dubbele gegevens.
