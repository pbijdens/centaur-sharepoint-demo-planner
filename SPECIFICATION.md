# Specificatie — Halplanning

Versie 0.3 — 2 november 2026 (eerste implementatie)

## 1. Doel en context

Centaur organiseert demo's (in de oorspronkelijke opzet "clinics" genoemd; in deze specificatie en in de software heet het overal **demo**). Aanvragen komen per e-mail binnen op de gedeelde Office 365-mailbox **halplanning**. Een medewerker (de *agent*) handelt de aanvraag af: correspondentie voeren, een geschikte datum zoeken in de gedeelde agenda, de demo inplannen, begeleiders toewijzen en uiteindelijk factureren.

De applicatie vervangt de huidige Power App (gebaseerd op Dataverse) en gebruikt **SharePoint-lijsten** als opslag, de **gedeelde mailbox** voor e-mail en de **agenda van de gedeelde mailbox** voor de planning.

### 1.1 Begrippen

| Begrip | Betekenis |
|---|---|
| Agent | Medewerker (een mens) die de applicatie gebruikt en aanvragen afhandelt. |
| Aanvraag (Request) | Eén klantvraag met de bijbehorende e-mailconversatie, klantgegevens, notities en één of meer demo's. |
| Bericht | Eén e-mail (inkomend of uitgaand) die bij een aanvraag hoort. |
| Demo | Eén geplande activiteit op een datum/tijd, met type, deelnemers, begeleiders en agenda-items. Een aanvraag kan meerdere demo's hebben. |
| Begeleider | Vrijwilliger/medewerker die helpt bij een demo. Begeleiders gebruiken de app zelf niet. |
| Inzet | De toewijzing van een begeleider aan een demo, eventueel met een eigen duur. |
| Standaardantwoord | Herbruikbaar tekstblok ("canned response") dat in een antwoord kan worden ingevoegd. |
| Potloodplanning | Een demo voorlopig ("onder voorbehoud") in de agenda zetten. |
| Definitief maken | Een potloodplanning bevestigen: datum, tijd en duur liggen vast. |

## 2. Architectuur (gekozen)

```
Gedeelde mailbox "halplanning"
   │  nieuwe e-mail
   ▼
Power Automate-flow (standaardconnectoren, draait 24/7 in de cloud)
   │  maakt/actualiseert Aanvraag + Bericht
   ▼
SharePoint-site  ──  lijsten (Aanvragen, Berichten, Demo's, Inzet, …)
   ▲
   │  lezen/schrijven als ingelogde gebruiker
SPFx-applicatie (React), getoond als Teams-app (desktop + mobiel) en als SharePoint-pagina
   │  Microsoft Graph (gedelegeerd, als ingelogde gebruiker)
   ├─ e-mail versturen vanuit de gedeelde mailbox
   └─ agenda van de gedeelde mailbox lezen en bijwerken
```

**Beslissingen**

| # | Beslissing | Reden |
|---|---|---|
| B1 | **SharePoint Framework (SPFx)**, gepubliceerd als Teams-app en SharePoint-pagina. | Geen eigen hosting, geen eigen backend en inloggen is volledig ingebouwd. Werkt in Teams mobiel en desktop. |
| B2 | **Power Automate-flow** verwerkt de inkomende e-mail. | Verwerking gebeurt altijd, ook als niemand de app open heeft, en er kan niet dubbel verwerkt worden door twee agents tegelijk. Alleen standaardconnectoren (geen premiumlicentie). |
| B3 | **SharePoint-lijsten** als opslag. | Geen Dataverse-licentie nodig. Rechten lopen via de SharePoint-site. |
| B4 | **Microsoft Graph met gedelegeerde rechten** voor e-mail en agenda. | Acties gebeuren onder de naam van de ingelogde agent. Rechten op de mailbox en de agenda worden door Exchange afgedwongen. |
| B5 | **Pushsynchronisatie** van app naar agenda (geen pull). | De app is de bron van waarheid. Wijzigingen die iemand direct in Outlook maakt, worden bij de volgende synchronisatie overschreven. |
| B6 | Excel en afbeeldingen worden **in de browser** gegenereerd. | Geen backend nodig. |
| B7 | De lijsten staan op de **site waarin de app draait**: de SharePoint-site van het team als de app in Teams staat, of de SharePoint-site zelf bij gebruik als SharePoint-pagina. | Eén oplossing die per team/site inzetbaar is, zonder vaste site-URL. |
| B8 | Het **adres van de gedeelde mailbox** en de **agenda** zijn configuratie, in te stellen via het instellingenscherm van de app. | Er zitten geen tenant-specifieke waarden in de code. |
| B9 | De app draait als **tabblad in een team** (en als SharePoint-webonderdeel), **niet als persoonlijke app**. | Een persoonlijke app heeft geen teamsite als context, terwijl de lijsten op de teamsite staan (B7). |
| B10 | De flow legt alleen vast wat de trigger levert (onder meer het adres van de afzender). De **app vult de naam van de afzender en de Outlook-link aan** via Graph zodra een agent de aanvraag opent. Berichten worden in Graph gezocht op `InternetMessageId`. | Houdt de flow eenvoudig; `InternetMessageId` blijft gelijk als een bericht naar een andere map wordt verplaatst, een Graph-id niet. |

## 3. Gebruikers en rechten

- **Agents**: lid van het team / de SharePoint-site (minimaal *Bewerken*) en hebben op de gedeelde mailbox **Volledige toegang**, **Verzenden als** en **Editor** op de agendamap. Ken deze rechten bij voorkeur toe via een beveiligingsgroep met e-mail (bijvoorbeeld *Halplanning-agents*).
- **Beheerder** (tenantbeheerder): keurt eenmalig de Graph-rechten van de SPFx-oplossing goed en installeert de app in Teams.
- **Flow-eigenaar**: een account met **Volledige toegang** op de gedeelde mailbox en *Bewerken* op de SharePoint-site. Bij voorkeur een functioneel/serviceaccount, zodat de flow niet afhangt van één persoon.

De PowerShell-commando's om deze rechten toe te kennen, te controleren en in te trekken staan in [docs/rechten-toekennen.md](docs/rechten-toekennen.md).
- Alle agents hebben dezelfde rechten; er zijn geen rollen binnen de app.

Benodigde gedelegeerde Graph-rechten (aan te vragen in `package-solution.json`):

| Recht | Waarvoor |
|---|---|
| `Mail.ReadWrite.Shared` | Berichten in de gedeelde mailbox lezen, conceptantwoorden maken en een weblink ophalen. |
| `Mail.Send.Shared` | Antwoorden versturen vanuit de gedeelde mailbox. |
| `Calendars.ReadWrite.Shared` | Agenda van de gedeelde mailbox lezen en afspraken maken, wijzigen en verwijderen. |

De SharePoint-lijsten worden benaderd met de eigen SharePoint-rechten van de gebruiker (SPHttpClient/PnPjs), dus daarvoor is geen extra Graph-recht nodig. Voor het aanmaken van categorieën wordt bewust geen extra recht aangevraagd (zie risico R2).

## 4. Functionele eisen

### 4.1 E-mailverwerking (flow)

| ID | Eis |
|---|---|
| FR-01 | Elke nieuwe e-mail in het Postvak IN van *halplanning* wordt precies één keer verwerkt. Dubbele verwerking wordt voorkomen op basis van `InternetMessageId`. |
| FR-02 | Koppelregels, in deze volgorde: **(1)** er is een *open* aanvraag met hetzelfde `ConversationId` → bericht toevoegen aan die aanvraag. **(2)** Er is een *open* aanvraag met hetzelfde afzenderadres → bericht toevoegen aan die aanvraag (bij meerdere: de aanvraag met het meest recente bericht). **(3)** Anders → nieuwe aanvraag met status *Nieuw*. |
| FR-03 | "Open" betekent: status *Nieuw*, *In afwachting*, *Bevestigd*, *Klaar voor facturatie* of *Gefactureerd*. Bij *Gesloten* en *Verwijderd* wordt nooit automatisch gekoppeld; er ontstaat dan een nieuwe aanvraag. |
| FR-04 | Per bericht worden opgeslagen: afzender (naam + adres), ontvangers, onderwerp, ontvangstmoment, HTML-body, `ConversationId`, `InternetMessageId`, Graph-bericht-id, of er bijlagen zijn, en een link om het bericht in Outlook (web) te openen. Bijlagen zelf worden niet opgeslagen. |
| FR-05 | Na koppelen wordt op de aanvraag `LaatsteBerichtOp` bijgewerkt en `Onbeantwoord` op *ja* gezet. |
| FR-06 | Bij een nieuwe aanvraag worden Titel, Naam en E-mailadres gevuld met het adres van de afzender. Zodra een agent de aanvraag opent, vervangt de app het adres in Naam en Titel door de naam van de afzender (B10). |
| FR-07 | Het mailboxadres en de site-URL zijn in de flow **omgevingsvariabelen** van de Power Platform-oplossing. Bij inzet voor een ander team worden die variabelen ingevuld; er is geen aanpassing van de flow zelf nodig. |

### 4.2 Overzicht van aanvragen (startscherm)

| ID | Eis |
|---|---|
| FR-10 | Het startscherm toont een lijst van aanvragen, standaard gesorteerd op `LaatsteBerichtOp` (nieuwste eerst; zie FR-17 voor andere sorteringen). Dat is het moment waarop het laatste **inkomende** bericht binnenkwam; een verzonden antwoord verandert de volgorde niet. De lijst ververst elke minuut. |
| FR-11 | Aanvragen met `Onbeantwoord = ja` zijn duidelijk gemarkeerd (vet, met een accentkleur en een indicator). |
| FR-12 | De status van elke aanvraag is direct zichtbaar als gekleurd label. |
| FR-13 | Er kan gefilterd worden op elke status (meerdere tegelijk mogelijk). Standaard staan alle statussen behalve *Gesloten* en *Verwijderd* aan. *Verwijderd* is alleen zichtbaar als daar expliciet op gefilterd wordt. |
| FR-14 | Er kan gezocht worden op naam, organisatie, e-mailadres en titel. |
| FR-15 | De status kan direct vanuit de lijst gewijzigd worden (bijvoorbeeld via een snelmenu of veegactie op mobiel), zonder de aanvraag te openen. |
| FR-16 | Een aanvraag kan als "verwerkt" gemarkeerd worden (`Onbeantwoord = nee`), ook zonder te antwoorden. |
| FR-17 | De lijst kan gesorteerd worden op **laatste bericht** (standaard, nieuwste eerst), op **eerstvolgende demo** (start van de vroegste demo die nog niet is afgelopen, vroegste eerst; aanvragen zonder komende demo onderaan, daarbinnen op laatste bericht) en op **status** (in de volgorde van §4.3, daarbinnen op laatste bericht). De gekozen sortering wordt per apparaat onthouden. |
| FR-18 | Heeft een aanvraag een demo, dan toont de lijst de datum en tijd van de eerstvolgende demo, of van de laatste demo als er geen komende demo meer is (gedimd). Heeft de aanvraag meer dan één demo, dan staat er een teller bij (bijvoorbeeld "+2" bij drie demo's). |
| FR-19 | Op de plek van de markering voor onbeantwoord (FR-11) toont de lijst een rode agenda met uitroepteken als een komende demo van de aanvraag niet in de agenda staat, en rode personen met uitroepteken als een komende demo te weinig begeleiders heeft. "Komend" betekent: nog niet afgelopen. Bij aanvragen met status *Verwijderd* staan deze markeringen niet. |

### 4.3 Statussen

`Nieuw` → `In afwachting` → `Bevestigd` → `Klaar voor facturatie` → `Gefactureerd` → `Gesloten`, plus `Verwijderd`.

| ID | Eis |
|---|---|
| FR-20 | Elke status kan met één handeling naar elke andere status worden gezet. De volgorde hierboven is de gebruikelijke route, maar wordt niet afgedwongen. |
| FR-21 | *Verwijderd* is een zachte verwijdering: de aanvraag blijft bewaard en kan teruggezet worden. Na bevestiging worden de agenda-afspraken van alle demo's van de aanvraag **verwijderd**. Wordt de aanvraag later teruggezet, dan kunnen de afspraken opnieuw worden aangemaakt (FR-57). |
| FR-23 | Bij *Gesloten* blijven de agenda-afspraken staan. |
| FR-22 | Statuswijzigingen worden vastgelegd (wie, wanneer, van → naar) in de geschiedenis van de aanvraag. |
| FR-24 | *Gefactureerd* betekent dat de factuur verstuurd is maar de aanvraag nog niet gesloten: er kan nog over de factuur gecorrespondeerd worden, dus nieuwe e-mail wordt nog gekoppeld (FR-03). |

### 4.4 Aanvraag behandelen

| ID | Eis |
|---|---|
| FR-30 | De detailweergave toont de conversatie (alle berichten in tijdsvolgorde), de klantgegevens, de demo's, de begeleiders en de notities. Geciteerde eerdere berichten in een e-mailbody zijn standaard ingeklapt en kunnen uitgeklapt worden. De opgeslagen body blijft ongewijzigd. |
| FR-31 | Bij elk bericht staat een link "Openen in Outlook". Heeft een bericht bijlagen, dan staat er een paperclip-indicator bij. De bijlagen zelf worden niet in de app getoond; ze zijn bereikbaar via de Outlook-link. |
| FR-32 | **Antwoorden** gebeurt in een rich-text-editor. De **afzender is altijd de gedeelde mailbox** ("Verzenden als", niet "Verzenden namens"): de ontvanger ziet alleen het adres van de gedeelde mailbox, niet de naam van de agent. De verzonden mail komt in *Verzonden items* van de gedeelde mailbox. Het antwoord gaat als antwoord binnen de bestaande conversatie (op het meest recente inkomende bericht). Standaard is dat **allen beantwoorden**: de afzender en alle Aan/CC-ontvangers, behalve de gedeelde mailbox zelf. De agent kan de ontvangers (Aan/CC) vóór verzending aanpassen. |
| FR-33 | Standaardantwoorden kunnen met één klik op de cursorpositie worden ingevoegd. |
| FR-34 | De handtekening wordt read-only onder de editor getoond en bij verzenden automatisch toegevoegd, gescheiden van de tekst door een witregel. |
| FR-35 | Een verzonden antwoord wordt als uitgaand bericht aan de aanvraag toegevoegd en zet `Onbeantwoord` op *nee*. |
| FR-36 | Bij een aanvraag zonder inkomend bericht (handmatig aangemaakt) wordt een nieuwe e-mail gestuurd naar het e-mailadres van de aanvraag. |
| FR-37 | *(Toekomst)* Een AI-prompt stelt een conceptantwoord voor. De editor moet zo opgezet worden dat tekst programmatisch ingevoegd kan worden. |
| FR-38 | **Beschikbaarheid controleren**: een dagweergave van de gedeelde agenda, met **alle** afspraken van die dag, inclusief afspraken voor de hele dag en meerdaagse afspraken. |
| FR-39 | Snel naar een datum springen via een datumkiezer, vorige/volgende dag en snelknoppen voor datums die in de e-mail genoemd worden. Het herkennen van datums in de tekst is gewenst maar niet verplicht in versie 1 (zie FR-90). |
| FR-40 | Vanuit de dagweergave kan direct een tijdvak gekozen worden om een demo in potlood te zetten. |
| FR-41 | Een bericht kan handmatig naar een andere aanvraag worden verplaatst (correctie op koppelregel FR-02 stap 2). |
| FR-42 | **Notities**: agents kunnen notities toevoegen die voor alle agents zichtbaar zijn, met auteur en tijdstip. Elke agent kan een notitie wijzigen (met ETag-controle) of verwijderen (na bevestiging). Een gewijzigde notitie toont wie haar het laatst heeft gewijzigd en wanneer. |
| FR-43 | **Definitief verwijderen** verwijdert de aanvraag met alle berichten, demo's, inzet en notities, plus de bijbehorende agenda-items. Dit vereist een bevestiging. De lijstitems gaan naar de prullenbak van de site, zodat een sitebeheerder ze in noodgevallen kan herstellen; de e-mails in de mailbox blijven bestaan. |
| FR-44 | **Samenvoegen**: een aanvraag kan worden samengevoegd met een andere aanvraag (het doel, elke status behalve *Verwijderd*). Alle berichten, demo's (met inzet en agenda-afspraken), notities en statuswijzigingen gaan naar het doel. Lege klantgegevens van het doel worden aangevuld met die van de samengevoegde aanvraag; afwijkende gegevens worden niet overschreven maar in een notitie bij het doel vastgelegd, samen met de titel van de samengevoegde aanvraag. `Onbeantwoord` wordt *ja* als een van beide onbeantwoord was en `LaatsteBerichtOp` wordt de laatste van beide. De status van het doel blijft gelijk. Daarna gaat de samengevoegde aanvraag naar de prullenbak van de site. Dit vereist een bevestiging. |
| FR-45 | **Demo verplaatsen**: een demo kan naar een andere bestaande aanvraag worden verplaatst (elke status behalve *Verwijderd*). Inzet en agenda-afspraken gaan mee; de afspraken zelf veranderen niet. Beide aanvragen krijgen een notitie. |

### 4.5 Klantgegevens (per aanvraag)

| Veld | Type | Bijzonderheden |
|---|---|---|
| Titel | tekst | Standaard: naam van de afzender. Wordt het onderwerp van de agenda-afspraak. |
| Naam | tekst | Standaard: naam van de afzender. |
| Organisatie | tekst | |
| E-mailadres | tekst | Standaard: adres van de afzender. Wordt gevalideerd. |
| Telefoonnummer | tekst | |
| IBAN | tekst | Wordt gevalideerd met de mod-97-controle; een waarschuwing blokkeert niet. |

### 4.6 Demo's (één of meer per aanvraag)

| Veld | Type | Bijzonderheden |
|---|---|---|
| Datum + begintijd | datum/tijd | Europe/Amsterdam |
| Duur | minuten | Standaard 60 |
| Titel | tekst | Standaard: Titel van de aanvraag. |
| Type demo | keuze uit beheerlijst | Beginwaarden: Feest met barbecue, Feest met koud buffet, Bedrijfsdemo, Privé demo, Schoolklas, Kinderfeestje, Privéles, Onbekend |
| Aantal deelnemers | getal | |
| Aantal begeleiders nodig | getal | Standaard 2 |
| Borrel gewenst | keuze | geen, vooraf, achteraf, beide, patat met snack achteraf, onbekend |
| Wedstrijd gewenst | keuze | ja, nee, onbekend |
| Prijsafspraak | tekst (meerregelig) | |
| Notitie | tekst (meerregelig) | |
| Planningsstatus | keuze | Voorlopig, Definitief |

| ID | Eis |
|---|---|
| FR-50 | **In potlood zetten** maakt in de gedeelde agenda drie afspraken: "Opbouwen demo" (30 min. direct vóór de demo), de demo zelf en "Opruimen demo" (30 min. direct na de demo). Alle drie staan als **Voorlopig (tentative)** en krijgen de categorie **"Gereserveerd"**. De opbouw- en opruimtijd is altijd 30 minuten en is niet instelbaar. |
| FR-51 | **Definitief maken** legt datum, tijd en duur vast, zet alle drie de afspraken op **Bezet**, geeft de hoofdafspraak de categorie **"Demo"** en de opbouw- en opruimafspraken de categorie **"Gereserveerd (bevestigd)"**. De app stelt voor om de aanvraag naar *Bevestigd* te zetten. |
| FR-52 | Ontbrekende categorieën worden aangemaakt (zie risico R2). |
| FR-53 | Het **onderwerp** van de hoofdafspraak is de titel van de demo. Opbouw/opruim: "Opbouwen demo – {titel}" en "Opruimen demo – {titel}". |
| FR-54 | De **beschrijving** van de hoofdafspraak bevat het type demo, het aantal deelnemers en de waarde van *Borrel gewenst*. |
| FR-55 | De **locatie** van de hoofdafspraak bevat de namen van de toegewezen begeleiders, en de tekst ***help gezocht*** als het aantal toegewezen begeleiders lager is dan *Aantal begeleiders nodig*. |
| FR-56 | **Synchronisatie (push)**: elke wijziging in de app die invloed heeft op de agenda (datum, tijd, duur, titel, type, deelnemers, borrel, begeleiders, planningsstatus) werkt de drie afspraken direct bij. Opbouw en opruim schuiven mee met de demo. |
| FR-57 | Bestaat een afspraak niet meer in de agenda (bijvoorbeeld verwijderd in Outlook), dan meldt de app dat en kan de agent hem opnieuw laten aanmaken. |
| FR-58 | Een demo verwijderen uit de aanvraag verwijdert ook de drie agenda-afspraken (met bevestiging). |
| FR-59 | **Demo dupliceren**: een demo kan binnen dezelfde aanvraag worden gekopieerd naar één of meer andere datums en tijden. Elke kopie krijgt dezelfde gegevens (titel, duur, type, deelnemers, begeleiders nodig, borrel, wedstrijd, prijsafspraak, notitie en planningsstatus) en dezelfde toegewezen begeleiders, en krijgt direct haar eigen drie agenda-afspraken (FR-50/FR-51). |

### 4.7 Begeleiders toewijzen

| ID | Eis |
|---|---|
| FR-60 | Per demo kunnen begeleiders uit de beheerlijst worden toegewezen, eventueel met een eigen duur in minuten (standaard: de duur van de demo). |
| FR-61 | Per demo is zichtbaar hoeveel begeleiders zijn toegewezen ten opzichte van het aantal dat nodig is (bijvoorbeeld "1 / 2"). Elke toegewezen begeleider telt volledig mee, ook als die een kortere duur heeft. |
| FR-62 | Een begeleider kan niet twee keer aan dezelfde demo worden toegewezen. |

### 4.8 Hoofdmenu (hamburgermenu)

| ID | Menu-item | Eis |
|---|---|---|
| FR-70 | Nieuwe aanvraag | Handmatig een aanvraag aanmaken (zonder e-mail). |
| FR-71 | Standaardantwoorden | Toevoegen, wijzigen, verwijderen en sorteren (titel + rich text). |
| FR-72 | Begeleiders | Beheren: naam, telefoon, e-mail, actief/inactief. Inactieve begeleiders zijn niet meer toe te wijzen, maar blijven zichtbaar in de historie. |
| FR-73 | Soorten demo | Beheren: naam, volgorde, actief/inactief. |
| FR-74 | Handtekening | Eén gedeelde handtekening (rich text) bewerken. |
| FR-80 | Instellingen | Het adres van de gedeelde mailbox instellen en daarna de agenda kiezen uit de agenda's van die mailbox. Daarbij controleert de app of de ingelogde gebruiker toegang heeft tot de mailbox en de agenda. Zolang dit niet is ingesteld, toont de app bij het openen het instellingenscherm. |
| FR-81 | Installatie op een site | Ontbreken de lijsten op de huidige site (of kolommen, of keuzes in een keuzekolom, zoals een nieuwe status), dan biedt de app aan om ze aan te maken, met kolommen, indexen en beginwaarden (zoals de soorten demo). Dit vereist rechten als site-eigenaar; andere gebruikers krijgen een melding dat een eigenaar de app eerst moet installeren. |
| FR-75 | Excel-export | Vraagt om een periode (van/tot) en maakt een .xlsx met deze tabbladen: **Demo's** (alle demo's in de periode met alle velden), **Begeleiders**, **Demo × begeleider** (matrix), **Uren per begeleider** (aantal demo's en totale uren), **Demo's per type** (aantal demo's en deelnemers). |
| FR-76 | Hulp gezocht | Vraagt om het aantal weken (standaard 4) en maakt een **afbeelding** met een tabel van alle demo's vanaf vandaag in die periode die nog onvoldoende begeleiders hebben. Kolommen: datum, tijd, duur, titel, type en aantal deelnemers. De begeleiders die al zijn ingezet staan cursief en iets kleiner onder de titel. Is er een borrel gewenst (alles behalve *geen* en *onbekend*), dan staat dat opvallend achter de titel, omdat niet elke begeleider een borrel kan verzorgen. |
| FR-77 | Komende demo's | Zoals FR-76 (inclusief begeleiders en borrel), maar met **alle** demo's. Daarbij een eerste kolom met een vinkje als de bezetting compleet is, en een duidelijke markering als er nog hulp nodig is. |
| FR-78 | Factuurlijst | Download een .xlsx met alle gegevens van alle aanvragen met status *Klaar voor facturatie* (werkblad *Te factureren*) en *Gefactureerd* (werkblad *Gefactureerd*): alle klantvelden (§4.5) en alle demovelden (§4.6), inclusief de prijsafspraak en de toegewezen begeleiders. Eén rij per demo. |
| FR-79 | Afbeeldingen (FR-76/77) kunnen worden **gedeeld** (deelmenu van het toestel, bijvoorbeeld WhatsApp), naar het **klembord gekopieerd** en als **PNG gedownload**. Opties die op het toestel niet beschikbaar zijn, worden verborgen. |

### 4.9 Later

| ID | Eis |
|---|---|
| FR-90 | Datums in de tekst van e-mails herkennen en als snelknoppen tonen. |
| FR-91 | AI-conceptantwoord (zie FR-37). |
| FR-92 | Eenmalige import van bestaande gegevens uit een JSON-bestand (formaat volgt). |

## 5. Niet-functionele eisen

| ID | Eis |
|---|---|
| NFR-01 | Werkt goed op **mobiel** (Teams-app voor iOS/Android, schermbreedte vanaf 360 px) en op **desktop** (Teams en browser). Ontwerp mobile-first en bedien alles met aanraking. |
| NFR-02 | Alle teksten in de software zijn **Nederlands**. Datums en getallen staan in Nederlandse notatie en de tijdzone is Europe/Amsterdam. |
| NFR-03 | Er is geen eigen backend of hosting. Alles draait in SPFx, SharePoint, Power Automate en Microsoft 365. |
| NFR-04 | Er is geen aparte login: de app gebruikt de identiteit uit Teams/SharePoint. |
| NFR-05 | Gelijktijdig bewerken: wijzigingen worden opgeslagen met ETag-controle. Bij een conflict krijgt de gebruiker een melding met de keuze om te verversen. |
| NFR-06 | De HTML van e-mails wordt vóór weergave opgeschoond (sanitizing), zodat er geen scripts of externe trackers worden uitgevoerd. |
| NFR-07 | Prestaties: het startscherm laadt binnen 3 seconden bij 1.000 open aanvragen. De lijsten zijn geïndexeerd op de kolommen waarop gefilterd wordt (zie §6). Houd rekening met de drempel van 5.000 items per lijstweergave. |
| NFR-08 | Alle documentatie is in het Nederlands. |

## 6. Gegevensmodel (SharePoint-lijsten)

Interne kolomnamen zonder spaties en accenten; weergavenamen in het Nederlands. *Idx* = geïndexeerde kolom.

```
Aanvraag 1 ──< Bericht
Aanvraag 1 ──< Notitie
Aanvraag 1 ──< Statuswijziging
Aanvraag 1 ──< Demo 1 ──< Inzet >── 1 Begeleider
Demo >── 1 DemoType
```

### Aanvragen
| Kolom | Type | Opmerking |
|---|---|---|
| Title (Titel) | tekst | |
| Naam | tekst | |
| Organisatie | tekst | |
| Email | tekst | Idx |
| Telefoon | tekst | |
| IBAN | tekst | |
| Status | keuze | Nieuw / In afwachting / Bevestigd / Klaar voor facturatie / Gefactureerd / Gesloten / Verwijderd — Idx |
| Onbeantwoord | ja/nee | Idx |
| LaatsteBerichtOp | datum/tijd | Idx, sortering |
| Bron | keuze | E-mail / Handmatig |

### Berichten
| Kolom | Type | Opmerking |
|---|---|---|
| Title | tekst | onderwerp |
| Aanvraag | lookup → Aanvragen | Idx |
| Richting | keuze | Inkomend / Uitgaand |
| VanNaam, VanAdres | tekst | VanAdres Idx |
| Aan, Cc | tekst | |
| OntvangenOp | datum/tijd | |
| Body | meerregelige tekst (HTML) | |
| ConversationId | tekst | Idx |
| InternetMessageId | tekst | Idx, uniek (deduplicatie) |
| GraphMessageId | tekst | voor antwoorden en de weblink |
| HeeftBijlagen | ja/nee | voor de paperclip-indicator |
| OutlookLink | hyperlink | |
| VerstuurdDoor | persoon | alleen bij uitgaand |

### Demo's
| Kolom | Type | Opmerking |
|---|---|---|
| Title (Titel) | tekst | |
| Aanvraag | lookup → Aanvragen | Idx |
| Start | datum/tijd | Idx |
| DuurMinuten | getal | |
| DemoType | lookup → DemoTypes | |
| AantalDeelnemers | getal | |
| BegeleidersNodig | getal | standaard 2 |
| Borrel | keuze | geen / vooraf / achteraf / beide / patat met snack achteraf / onbekend |
| Wedstrijd | keuze | ja / nee / onbekend |
| Prijsafspraak | meerregelige tekst | |
| Notitie | meerregelige tekst | |
| Planningsstatus | keuze | Voorlopig / Definitief |
| EventIdDemo, EventIdOpbouwen, EventIdOpruimen | tekst | Graph-event-id's |
| LaatsteSyncOp | datum/tijd | |

### Inzet
| Kolom | Type |
|---|---|
| Demo | lookup → Demo's (Idx) |
| Begeleider | lookup → Begeleiders (Idx) |
| DuurMinuten | getal (leeg = duur demo) |

### Begeleiders
Title (naam), Telefoon, Email, Actief (ja/nee).

### DemoTypes
Title, Volgorde, Actief.

### Standaardantwoorden
Title, Tekst (rich text), Volgorde.

### Notities
Aanvraag (lookup, Idx), Tekst. Auteur en tijdstip komen uit de systeemkolommen *Gemaakt door* en *Gemaakt*.

### Statuswijzigingen
Aanvraag (lookup, Idx), VanStatus, NaarStatus. Wie en wanneer komen uit de systeemkolommen.

### Instellingen
Title (sleutel), Waarde (meerregelig). Sleutels: `Handtekening`, `MailboxAdres`, `AgendaId` (Graph-id van de gekozen agenda in de mailbox), `AgendaNaam` (alleen voor weergave).

Koppelregel 1 (zelfde conversatie) zoekt via `Berichten.ConversationId` naar de aanvraag; een aparte kolom op *Aanvragen* is daarvoor niet nodig.

Vaste waarden in de code, niet instelbaar: opbouw- en opruimtijd 30 minuten, standaardduur van een demo 60 minuten, categorieën "Gereserveerd" (voorlopig), "Demo" en "Gereserveerd (bevestigd)" (definitief).

## 7. Use cases

### UC-01 Inkomende e-mail verwerken
**Actor:** Power Automate-flow. **Trigger:** nieuwe e-mail in *halplanning*.
1. De flow controleert of `InternetMessageId` al bestaat in *Berichten*. Zo ja: stoppen.
2. De flow zoekt een open aanvraag volgens koppelregels FR-02.
3. Niet gevonden: de flow maakt een aanvraag aan (status *Nieuw*, Titel/Naam/Email = afzender, Bron = E-mail).
4. De flow maakt een bericht aan (Richting = Inkomend) met alle velden uit FR-04.
5. De flow zet op de aanvraag `LaatsteBerichtOp` = ontvangstmoment, `Onbeantwoord` = ja en voegt het `ConversationId` toe.
**Uitzondering:** als de flow faalt, krijgt de flow-eigenaar een melding. Mislukte runs kunnen opnieuw worden uitgevoerd; stap 1 maakt dat veilig.

### UC-02 Overzicht bekijken en filteren
**Actor:** agent.
1. De agent opent de app; het startscherm toont de open aanvragen, gesorteerd op het laatste bericht.
2. Onbeantwoorde aanvragen zijn gemarkeerd en elke aanvraag toont een statuslabel.
3. De agent zet statusfilters aan of uit, of zoekt op tekst.
4. De agent sorteert eventueel op eerstvolgende demo of op status.
**Alternatief:** de agent kiest het filter *Verwijderd* en ziet alleen verwijderde aanvragen.

### UC-03 Status wijzigen
1. De agent kiest in de lijst of in de detailweergave een nieuwe status.
2. Het systeem slaat de wijziging op en legt een statuswijziging vast.
**Alternatief:** bij *Verwijderd* vraagt het systeem eerst om bevestiging en verwijdert daarna de agenda-afspraken van alle demo's (FR-21). Bij *Gesloten* blijven de afspraken staan.

### UC-04 Beantwoorden
1. De agent opent de aanvraag en kiest *Antwoorden*.
2. De agent typt tekst en voegt eventueel een standaardantwoord in; de handtekening staat read-only eronder.
3. De agent kiest *Versturen*.
4. Het systeem verstuurt het antwoord vanuit de gedeelde mailbox binnen de conversatie, legt het uitgaande bericht vast en zet `Onbeantwoord` = nee.
**Alternatief:** bij een handmatige aanvraag zonder inkomend bericht wordt een nieuwe e-mail verstuurd.
**Uitzondering:** verzenden mislukt (bijvoorbeeld omdat het recht *Verzenden als* ontbreekt). De agent krijgt een melding en de tekst blijft behouden.

### UC-05 Markeren als verwerkt
1. De agent kiest *Markeren als verwerkt* in de lijst of de detailweergave; `Onbeantwoord` wordt nee.

### UC-06 Beschikbaarheid controleren
1. De agent opent het tabblad *Agenda* binnen de aanvraag.
2. Het systeem toont de dagweergave van vandaag of van de datum van de eerste demo, met alle afspraken inclusief hele-dagafspraken.
3. De agent springt naar een andere datum met de datumkiezer, met vorige/volgende of met een snelknop.

### UC-07 Demo in potlood zetten
1. De agent kiest in de dagweergave een begintijd en geeft een duur op (of kiest *Nieuwe demo* in de aanvraag).
2. Het systeem maakt een demo aan (Planningsstatus = Voorlopig) met standaardwaarden uit de aanvraag.
3. Het systeem maakt drie afspraken aan (opbouwen, demo, opruimen) als *Voorlopig* en slaat de event-id's op.
4. Het systeem stelt voor om de aanvraag op *In afwachting* te zetten.

### UC-08 Demo definitief maken
1. De agent controleert datum, tijd en duur en kiest *Definitief maken*.
2. Het systeem zet de Planningsstatus op Definitief en de drie afspraken op *Bezet* met categorieën *Demo* en *Gereserveerd (bevestigd)*.
3. Het systeem stelt voor om de aanvraag op *Bevestigd* te zetten.

### UC-09 Demo- en klantgegevens invullen of wijzigen
1. De agent wijzigt velden van de aanvraag of de demo en slaat op.
2. Als er agendavelden zijn gewijzigd, werkt het systeem de afspraken bij (FR-56).

### UC-10 Begeleiders toewijzen
1. De agent kiest bij een demo *Begeleider toevoegen*, selecteert een actieve begeleider en geeft eventueel een duur op.
2. Het systeem slaat de inzet op, werkt de bezetting bij ("2 / 2") en past de locatie van de hoofdafspraak aan, inclusief of de tekst *help gezocht* nog nodig is.
**Alternatief:** een begeleider verwijderen werkt op dezelfde manier en zorgt ook dat de agenda wordt bijgewerkt.

### UC-11 Notitie toevoegen, wijzigen of verwijderen
1. De agent typt een notitie en slaat op; deze verschijnt met naam en tijdstip.
**Alternatief:** de agent kiest bij een notitie *Wijzigen*, past de tekst aan en slaat op, of kiest *Verwijderen* en bevestigt.

### UC-12 Aanvraag definitief verwijderen
1. De agent kiest *Definitief verwijderen*.
2. Het systeem vraagt om bevestiging en noemt daarbij wat er verwijderd wordt (berichten, demo's, agenda-items).
3. Het systeem verwijdert de agenda-afspraken en daarna alle gekoppelde lijstitems en de aanvraag.

### UC-13 Bericht verplaatsen
1. De agent kiest bij een bericht *Verplaatsen naar…* en kiest een andere aanvraag of *Nieuwe aanvraag*.
2. Het systeem past de koppeling aan en werkt `LaatsteBerichtOp` van beide aanvragen bij.

### UC-14 Handmatig een aanvraag aanmaken
1. Via de knop **+** op het startscherm of via het menu kiest de agent *Nieuwe aanvraag*, vult de klantgegevens in en slaat op (Bron = Handmatig, status *Nieuw*).

### UC-15 Stamgegevens beheren
Standaardantwoorden, begeleiders, soorten demo en de handtekening worden via het menu beheerd met eenvoudige lijst- en formulierschermen.

### UC-16 Excel-export
1. De agent kiest *Excel-export*, geeft een periode op en kiest *Downloaden*.
2. Het systeem maakt het .xlsx-bestand met de tabbladen uit FR-75 en biedt het aan als download.

### UC-17 Lijst "Hulp gezocht" / "Komende demo's"
1. De agent kiest het menu-item en past eventueel het aantal weken aan (standaard 4).
2. Het systeem toont een voorbeeld van de tabel en zet die om naar een afbeelding.
3. De agent kiest *Delen*, *Kopiëren* of *Downloaden*.

### UC-18 Factuurlijst
1. De agent kiest *Factuurlijst*; het systeem maakt een .xlsx met een werkblad *Te factureren* (aanvragen die *Klaar voor facturatie* zijn) en een werkblad *Gefactureerd* (aanvragen met status *Gefactureerd*).

### UC-19 Aanvragen samenvoegen
1. De agent kiest bij een aanvraag *Samenvoegen met…* en zoekt de aanvraag waarin deze moet opgaan.
2. Het systeem toont wat er gebeurt en vraagt om bevestiging.
3. Het systeem verplaatst berichten, demo's, notities en geschiedenis naar het doel, vult lege klantgegevens aan, legt afwijkende gegevens vast in een notitie, verwijdert de samengevoegde aanvraag en opent het doel.

### UC-20 Demo verplaatsen
1. De agent kiest bij een demo *Verplaatsen naar andere aanvraag…* en zoekt de aanvraag waar de demo heen moet.
2. Het systeem verplaatst de demo met inzet en agenda-afspraken en zet bij beide aanvragen een notitie (FR-45).

### UC-21 Demo dupliceren
1. De agent kiest bij een demo *Dupliceren…* en vult één of meer datums met begintijd in.
2. Het systeem maakt per datum een kopie van de demo met dezelfde begeleiders binnen dezelfde aanvraag en zet de afspraken in de agenda (FR-59).

## 8. Schermen (globaal)

1. **Startscherm**: bovenbalk met hamburgermenu en zoekveld, een rij statusfilters (chips) en de lijst met aanvragen (kaarten op mobiel, tabel op desktop).
2. **Aanvraag**: kop met titel, status (wijzigbaar) en acties. Tabbladen of secties: *Conversatie* (met antwoordeditor), *Gegevens*, *Demo's* (met begeleiders), *Agenda*, *Notities*, *Geschiedenis*.
3. **Agenda-dagweergave**: tijdlijn van één dag met een balk voor hele-dagafspraken bovenaan en de navigatie.
4. **Beheerschermen**: één per stamlijst.
5. **Export/lijst-dialogen**: periode of aantal weken kiezen, voorbeeld bekijken en actieknoppen.

## 9. Risico's en aandachtspunten

| # | Risico | Maatregel |
|---|---|---|
| R1 | De Graph-rechten van SPFx gelden **tenantbreed** voor alle SPFx-oplossingen. | Accepteren, of later overstappen op een eigen app-registratie. Dit bespreken met de beheerder. |
| R2 | Mastercategorieën van een **gedeelde** mailbox aanmaken via Graph met gedelegeerde rechten wordt mogelijk niet ondersteund. | De app probeert het en gaat bij een fout gewoon door. Lukt het niet, maak de categorieën dan eenmalig handmatig aan in Outlook ([docs/uitrol.md](docs/uitrol.md)). Afspraken mogen een categorienaam dragen die (nog) niet bestaat. **Te verifiëren in de tenant.** |
| R3 | De Outlook-weblink van een bericht in een gedeelde mailbox. | De app haalt `webLink` op via Graph (gezocht op `InternetMessageId`) en slaat die op bij het bericht (B10). **Te verifiëren in de tenant.** |
| R4 | Web Share API en klembord voor afbeeldingen werken mogelijk niet in de webview van Teams mobiel. | Opties die niet beschikbaar zijn verbergen; downloaden werkt altijd als terugvaloptie. Testen op iOS en Android. |
| R5 | Koppelregel 2 (zelfde afzender) kan een mail aan de verkeerde aanvraag koppelen. | UC-13 Bericht verplaatsen. |
| R6 | Wijzigingen die direct in Outlook worden gemaakt, worden overschreven. | Bewuste keuze (B5); vermelden in de gebruikershandleiding. |
| R7 | Lange e-mailbodies met citaten van eerdere berichten. | In de weergave het geciteerde deel inklappen. |

## 10. Plan van aanpak

Stand van zaken op 2 november 2026. "Gebouwd" betekent: de code staat er, compileert en de pure logica is getest met unit-tests. Getest tegen een echte tenant is nog niets.

| Fase | Inhoud | Status |
|---|---|---|
| 0. Technische controle | Graph-rechten op de gedeelde mailbox (lezen, antwoorden als de mailbox, agenda lezen/schrijven, categorieën, webLink) en delen/klembord in Teams mobiel. | **Open**: moet in de tenant gebeuren (risico's R2–R4) |
| 1. Installatie en instellingen | Lijsten aanmaken en bijwerken vanuit de app (FR-81) en het instellingenscherm voor mailbox en agenda (FR-80). | Gebouwd |
| 2. E-mailintake | Power Automate-flow (UC-01). | Beschreven in [docs/flow-inrichten.md](docs/flow-inrichten.md); de flow moet in de tenant worden ingericht |
| 3. Kern-app | Startscherm, filters, statuswijzigingen, detailweergave, conversatie, notities en verwijderen (UC-02, -03, -05, -11, -12, -13, -14). | Gebouwd |
| 4. Antwoorden | Editor, standaardantwoorden, handtekening, verzenden (UC-04, UC-15). | Gebouwd |
| 5. Agenda | Dagweergave, potloodplanning, definitief maken, push-sync, begeleiders (UC-06 t/m -10). | Gebouwd |
| 6. Rapportages | Excel-export, factuurlijst, afbeeldingen (UC-16 t/m -18). | Gebouwd |
| 7. Oplevering | Tests in de tenant (desktop en mobiel), gebruikershandleiding (NL), uitrol via de app-catalogus en Teams ([docs/uitrol.md](docs/uitrol.md)). | Open |
| 8. Later | JSON-import, datumherkenning, AI-conceptantwoord (FR-90 t/m -92). | Later |

## 11. Open vragen

| # | Vraag | Aanname tot er een antwoord is |
|---|---|---|
Er zijn op dit moment geen open vragen. Alle eerdere vragen (V1–V11) zijn beantwoord en verwerkt in de eisen en het gegevensmodel.
