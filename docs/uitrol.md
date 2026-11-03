# Halplanning uitrollen

Van broncode naar een werkende app in een Teams-team. Deze stappen zijn voor de beheerder.

## Overzicht

1. Pakket bouwen (`.sppkg`)
2. Pakket in de app-catalogus van de tenant zetten
3. Graph-rechten goedkeuren
4. App toevoegen aan Teams en als tabblad aan een team
5. Eerste keer openen: lijsten aanmaken en instellingen invullen
6. Power Automate-flow inrichten
7. Rechten voor agents toekennen

## 1. Pakket bouwen

Vereist: Node.js 22, 24 of 26 (zie `engines` in `package.json`).

```powershell
npm ci
npm run build
```

Het resultaat staat in `sharepoint/solution/halplanning.sppkg`.

Hoog bij elke nieuwe versie het versienummer op in `config/package-solution.json` (zowel `solution.version` als `features[0].version`), zodat SharePoint en Teams de update herkennen.

## 2. App-catalogus

1. Open het **SharePoint-beheercentrum → Meer functies → Apps → App-catalogus** (of *Apps beheren*).
2. Upload `halplanning.sppkg`.
3. Kies in de dialoog **Deze app beschikbaar maken voor alle sites** en *Implementeren*. De oplossing gebruikt `skipFeatureDeployment`, dus installeren per site is niet nodig.

## 3. Graph-rechten goedkeuren

Na het uploaden staan drie aanvragen klaar: `Mail.ReadWrite.Shared`, `Mail.Send.Shared` en `Calendars.ReadWrite.Shared`. Keur ze goed via **SharePoint-beheercentrum → Geavanceerd → API-toegang**, of via PowerShell ([rechten-toekennen.md](rechten-toekennen.md), stap 5).

## 4. Toevoegen aan Teams

1. Selecteer de app in de app-catalogus en kies **Synchroniseren met Teams** (*Sync to Teams*). Na enkele minuten staat Halplanning in de app-store van de organisatie in Teams.
2. Open in Teams het team waarin gepland wordt, ga naar een kanaal, kies **+** (tabblad toevoegen) en zoek *Halplanning*.
3. Sla het tabblad op. Er zijn geen instellingen bij het toevoegen.

De app werkt als **tabblad in een team** (desktop, web en de mobiele Teams-app). De lijsten komen op de SharePoint-site van dat team. Een persoonlijke app is bewust niet ondersteund: die draait niet in de context van een teamsite.

Liever als SharePoint-pagina? Voeg het webonderdeel *Halplanning* toe aan een pagina; dan komen de lijsten op die site. Gebruik voor de beste weergave een sectie over de volledige breedte.

## 5. Eerste keer openen

1. Open het tabblad als **eigenaar** van het team. De app meldt dat de lijsten ontbreken. Kies *Lijsten aanmaken*; dat duurt ongeveer een minuut.
2. Vul daarna in de instellingen het adres van de **gedeelde mailbox** in, kies *Toegang controleren* en selecteer de **agenda**. Sla op.
3. Vul via het menu de **begeleiders**, **standaardantwoorden** en de **handtekening** in. De soorten demo zijn al gevuld met de beginwaarden.

## 6. Power Automate-flow

Volg [flow-inrichten.md](flow-inrichten.md). Gebruik voor `SiteUrl` het adres van de teamsite. Dat vind je via *Bestanden → Openen in SharePoint* in het team; neem het deel tot en met `/sites/<naam>`.

## 7. Rechten voor agents

Volg [rechten-toekennen.md](rechten-toekennen.md): lidmaatschap van het team, plus Volledige toegang, Verzenden als en Editor op de agenda van de gedeelde mailbox.

## Categorieën in de agenda

De app probeert de categorieën **Demo**, **Gereserveerd** en **Gereserveerd (bevestigd)** zelf aan te maken in de gedeelde mailbox. Graph staat dat bij een gedeelde mailbox mogelijk niet toe (risico R2). Afspraken krijgen de categorienaam dan wel, maar zonder kleur. Maak de categorieën in dat geval één keer handmatig aan in Outlook (op de gedeelde mailbox: *Categoriseren → Alle categorieën*) en kies daar de kleuren.

## Bijwerken naar een nieuwe versie

1. Versienummer ophogen (zie stap 1) en `npm run build`.
2. Het nieuwe `.sppkg` uploaden in de app-catalogus (overschrijven) en implementeren.
3. Alleen als er nieuwe Graph-rechten bij zijn gekomen: opnieuw goedkeuren (stap 3).
4. Zijn er lijstkolommen bijgekomen, dan meldt de app dat bij het openen en kan een site-eigenaar ze laten toevoegen.
