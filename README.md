# Halplanning

Teams-app waarmee agents demo-aanvragen afhandelen die binnenkomen op de gedeelde mailbox *halplanning*: correspondentie, planning in de gedeelde agenda, begeleiders, rapportages en facturatie.

Gebouwd met SharePoint Framework 1.24 (React 18, Fluent UI v9). De gegevens staan in SharePoint-lijsten op de site van het team; e-mail en agenda gaan via Microsoft Graph, met de rechten van de ingelogde agent.

## Documentatie

| Document | Inhoud |
|---|---|
| [SPECIFICATION.md](SPECIFICATION.md) | Eisen, use cases, gegevensmodel, risico's en plan |
| [docs/uitrol.md](docs/uitrol.md) | Pakket bouwen, uitrollen in SharePoint en Teams, eerste keer openen |
| [docs/flow-inrichten.md](docs/flow-inrichten.md) | De Power Automate-flow die e-mail omzet in aanvragen |
| [docs/rechten-toekennen.md](docs/rechten-toekennen.md) | Rechten voor agents, het flow-account en de app (PowerShell) |

## Ontwikkelen

Vereist: Node.js 22, 24 of 26.

```powershell
npm ci
npm run build     # productiebuild, unit-tests en sharepoint/solution/halplanning.sppkg
npm run start     # lokale ontwikkelserver; test via de gehoste workbench van een SharePoint-site
npx heft test     # alleen bouwen en unit-tests draaien
```

Lokaal testen gaat via `https://<tenant>.sharepoint.com/sites/<site>/_layouts/15/workbench.aspx` met `npm run start` actief. Mail en agenda werken pas als de Graph-rechten zijn goedgekeurd (zie [docs/uitrol.md](docs/uitrol.md)).

## Builds en versies

Elke commit op `main` start de GitHub Action [Productiebuild](.github/workflows/build.yml). Die bouwt het pakket in productiemodus, draait de unit-tests en publiceert `halplanning.sppkg` als GitHub Release `v<major>.<minor>.<build>`.

Het versienummer wordt tijdens de build gezet door [scripts/versie-zetten.mjs](scripts/versie-zetten.mjs): major en minor komen uit `package.json`, het laatste deel is het runnummer van de action. Dezelfde versie komt in `package.json` (en dus in het manifest van het webonderdeel) en in de oplossing en de feature in `config/package-solution.json` (als `x.y.build.0`). Het nummer wordt niet teruggeschreven naar de repository; voor een nieuwe major- of minorversie pas je `package.json` handmatig aan.
