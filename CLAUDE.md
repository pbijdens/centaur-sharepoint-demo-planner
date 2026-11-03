# CLAUDE.md — Halplanning

Instructies voor Claude Code in deze repository. Zie [SPECIFICATION.md](SPECIFICATION.md) voor de volledige specificatie: eisen, use cases, gegevensmodel en open vragen.

## Project in het kort

Een Teams-app waarmee agents demo-aanvragen afhandelen die binnenkomen op de gedeelde mailbox **halplanning**: correspondentie, planning in de gedeelde agenda, begeleiders, rapportages en facturatie. De app vervangt een bestaande Power App (Dataverse).

## Architectuur (vastgesteld)

- **SPFx 1.24** (Heft-toolchain) met **React 18.3.1** en **Fluent UI v9**, uitgerold als **Teams-tabblad** en SharePoint-webonderdeel (geen persoonlijke app, B9). Er is geen eigen backend en geen eigen hosting.
- **SharePoint-lijsten** als opslag (zie §6 van de specificatie). Toegang via PnPjs/SPHttpClient met de rechten van de gebruiker. De lijsten staan altijd op de **huidige site** (`pageContext.web`): de teamsite in Teams, of de SharePoint-site zelf. Gebruik nooit een vaste site-URL. Ontbrekende lijsten maakt de app zelf aan (FR-81).
- **Microsoft Graph, gedelegeerd** (MSGraphClientV3) voor de gedeelde mailbox: e-mail versturen (`Mail.Send.Shared`), berichten lezen (`Mail.ReadWrite.Shared`) en de agenda (`Calendars.ReadWrite.Shared`). Het mailboxadres en het agenda-id komen uit de lijst *Instellingen* (FR-80); zet ze nooit in de code. Paden: `/users/{MailboxAdres}/…` en `/users/{MailboxAdres}/calendars/{AgendaId}/…`.
- Vaste waarden (constanten, niet instelbaar): opbouw- en opruimtijd 30 minuten, standaardduur van een demo 60 minuten, categorieën "Gereserveerd" (voorlopig), "Demo" en "Gereserveerd (bevestigd)".
- **Power Automate-flow** verwerkt inkomende e-mail naar aanvragen en berichten ([docs/flow-inrichten.md](docs/flow-inrichten.md)). De app vult de naam van de afzender en de Outlook-link aan via Graph (B10).
- Agenda-synchronisatie is **alleen push** (app → agenda). De app is de bron van waarheid.
- Excel en afbeeldingen worden **in de browser** gegenereerd. ExcelJS, html-to-image en de editor (TipTap) worden pas geladen wanneer ze nodig zijn (dynamische `import()`); houd zware bibliotheken uit de hoofdbundel.
- Mail die de app verstuurt heeft **altijd de gedeelde mailbox als afzender** (Verzenden als). Rechten voor gebruikers staan in [docs/rechten-toekennen.md](docs/rechten-toekennen.md); werk die bij als de app andere rechten nodig krijgt.

## Afspraken

- **Taal**: alle UI-teksten, documentatie, commitberichten en lijst-/kolomweergavenamen zijn in het **Nederlands**. Code-identifiers mogen Engels zijn, maar volg de domeintermen uit de specificatie (Aanvraag, Bericht, Demo, Begeleider, Inzet).
- Interne SharePoint-kolomnamen hebben geen spaties en geen accenten (bijvoorbeeld `LaatsteBerichtOp`).
- Gebruik overal "demo", niet "clinic".
- **Mobile-first**: alles moet werken in Teams mobiel (vanaf 360 px breed) en bedienbaar zijn met aanraking.
- Tijdzone Europe/Amsterdam; datums en getallen in Nederlandse notatie.
- Schoon de HTML van e-mails op (sanitize, bijvoorbeeld met DOMPurify) voordat die wordt weergegeven.
- Sla wijzigingen op met ETag-controle (gelijktijdig bewerken door meerdere agents).
- Nieuwe eisen of gewijzigde beslissingen: werk eerst `SPECIFICATION.md` bij (eisen-ID's FR-/NFR-, use cases UC-, open vragen V-).

## Commando's

Node.js 22, 24 of 26. In PowerShell moet na een verse Node-installatie het PATH opnieuw worden ingelezen.

- `npm run build`: productiebuild + unit-tests + `sharepoint/solution/halplanning.sppkg`. In productiemodus gelden **lint-waarschuwingen als fouten**.
- `npx heft test --clean`: bouwen en unit-tests (snel, zonder pakket).
- `npm run start`: ontwikkelserver voor de gehoste workbench.

Tests staan als `*.test.ts` naast de code en draaien met Jest (jsdom) op `lib-commonjs`. Test pure logica in `app/logic/`; die modules mogen niet van PnPjs, Graph of React afhangen.

## Opbouw van de code (`src/webparts/halplanning/`)

- `HalplanningWebPart.ts`: maakt de diensten aan en kiest het thema (Teams of SharePoint).
- `app/model.ts`: domeintypen en vaste waarden. `app/lists.ts`: lijstschema (bron voor installatie én data-laag).
- `app/logic/`: pure functies (datums, validatie, mail, agenda-afspraken, rapportages) met unit-tests.
- `app/services/`: `repository.ts` (SharePoint via PnPjs), `graph.ts` (mail en agenda), `acties.ts` (samengestelde acties zoals plannen, synchroniseren en versturen), `installatie.ts` (lijsten aanmaken en bijwerken).
- `app/components/`: schermen en dialogen. `app/rapporten/`: Excel en bestanden delen/downloaden.
- `app/App.tsx`: opstartcontroles (installatie → instellingen → app), navigatie en hoofdmenu.

Een nieuwe kolom: voeg hem toe aan `lists.ts` en aan de mapping in `repository.ts`. De app ziet bij het opstarten dat de kolom ontbreekt en laat een site-eigenaar hem toevoegen.

## Status

Fasen 1 en 3 t/m 6 zijn gebouwd; getest tegen een echte tenant is nog niets (zie §10 van de specificatie). Open: de technische controle in de tenant (R2–R4), het inrichten van de flow en de oplevering.
