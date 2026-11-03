// Schema van de SharePoint-lijsten (SPECIFICATION.md §6). Wordt gebruikt om lijsten aan te maken (FR-81)
// en door de data-laag voor de URL's van de lijsten.

import { BORREL_OPTIES, PLANNINGSSTATUSSEN, STATUSSEN, WEDSTRIJD_OPTIES } from './model';

export type VeldType = 'tekst' | 'notitie' | 'keuze' | 'janee' | 'datum' | 'getal' | 'lookup' | 'url';

export interface VeldDef {
  naam: string;
  weergave: string;
  type: VeldType;
  keuzes?: readonly string[];
  standaard?: string;
  /** Voor lookup: sleutel van de doellijst in LIJSTEN. */
  doel?: LijstSleutel;
  index?: boolean;
  uniek?: boolean;
}

export interface LijstDef {
  /** Deel van de URL: /Lists/{url}. Zonder spaties of accenten. */
  url: string;
  titel: string;
  /** Weergavenaam van de standaardkolom Title, leeg als die niet gebruikt wordt. */
  titleWeergave?: string;
  velden: VeldDef[];
}

export type LijstSleutel =
  | 'aanvragen'
  | 'berichten'
  | 'demos'
  | 'inzet'
  | 'begeleiders'
  | 'demoTypes'
  | 'standaardantwoorden'
  | 'notities'
  | 'statuswijzigingen'
  | 'instellingen';

export const LIJSTEN: Record<LijstSleutel, LijstDef> = {
  begeleiders: {
    url: 'Begeleiders',
    titel: 'Begeleiders',
    titleWeergave: 'Naam',
    velden: [
      { naam: 'Telefoon', weergave: 'Telefoon', type: 'tekst' },
      { naam: 'Email', weergave: 'E-mailadres', type: 'tekst' },
      { naam: 'Actief', weergave: 'Actief', type: 'janee', standaard: '1' }
    ]
  },
  demoTypes: {
    url: 'DemoTypes',
    titel: 'Soorten demo',
    titleWeergave: 'Naam',
    velden: [
      { naam: 'Volgorde', weergave: 'Volgorde', type: 'getal' },
      { naam: 'Actief', weergave: 'Actief', type: 'janee', standaard: '1' }
    ]
  },
  standaardantwoorden: {
    url: 'Standaardantwoorden',
    titel: 'Standaardantwoorden',
    titleWeergave: 'Titel',
    velden: [
      { naam: 'Tekst', weergave: 'Tekst', type: 'notitie' },
      { naam: 'Volgorde', weergave: 'Volgorde', type: 'getal' }
    ]
  },
  instellingen: {
    url: 'Instellingen',
    titel: 'Instellingen',
    titleWeergave: 'Sleutel',
    velden: [{ naam: 'Waarde', weergave: 'Waarde', type: 'notitie' }]
  },
  aanvragen: {
    url: 'Aanvragen',
    titel: 'Aanvragen',
    titleWeergave: 'Titel',
    velden: [
      { naam: 'Naam', weergave: 'Naam', type: 'tekst' },
      { naam: 'Organisatie', weergave: 'Organisatie', type: 'tekst' },
      { naam: 'Email', weergave: 'E-mailadres', type: 'tekst', index: true },
      { naam: 'Telefoon', weergave: 'Telefoon', type: 'tekst' },
      { naam: 'IBAN', weergave: 'IBAN', type: 'tekst' },
      { naam: 'Status', weergave: 'Status', type: 'keuze', keuzes: STATUSSEN, standaard: 'Nieuw', index: true },
      { naam: 'Onbeantwoord', weergave: 'Onbeantwoord', type: 'janee', standaard: '1', index: true },
      { naam: 'LaatsteBerichtOp', weergave: 'Laatste bericht op', type: 'datum', index: true },
      { naam: 'Bron', weergave: 'Bron', type: 'keuze', keuzes: ['E-mail', 'Handmatig'], standaard: 'E-mail' }
    ]
  },
  berichten: {
    url: 'Berichten',
    titel: 'Berichten',
    titleWeergave: 'Onderwerp',
    velden: [
      { naam: 'Aanvraag', weergave: 'Aanvraag', type: 'lookup', doel: 'aanvragen', index: true },
      { naam: 'Richting', weergave: 'Richting', type: 'keuze', keuzes: ['Inkomend', 'Uitgaand'], standaard: 'Inkomend' },
      { naam: 'VanNaam', weergave: 'Van (naam)', type: 'tekst' },
      { naam: 'VanAdres', weergave: 'Van (adres)', type: 'tekst', index: true },
      { naam: 'Aan', weergave: 'Aan', type: 'notitie' },
      { naam: 'Cc', weergave: 'Cc', type: 'notitie' },
      { naam: 'OntvangenOp', weergave: 'Ontvangen op', type: 'datum' },
      { naam: 'Body', weergave: 'Inhoud', type: 'notitie' },
      { naam: 'ConversationId', weergave: 'Conversatie-id', type: 'tekst', index: true },
      { naam: 'InternetMessageId', weergave: 'Internet-bericht-id', type: 'tekst', index: true, uniek: true },
      { naam: 'GraphMessageId', weergave: 'Graph-bericht-id', type: 'notitie' },
      { naam: 'OutlookLink', weergave: 'Link naar Outlook', type: 'url' },
      { naam: 'HeeftBijlagen', weergave: 'Heeft bijlagen', type: 'janee', standaard: '0' },
      { naam: 'VerstuurdDoor', weergave: 'Verstuurd door', type: 'tekst' }
    ]
  },
  demos: {
    url: 'Demos',
    titel: "Demo's",
    titleWeergave: 'Titel',
    velden: [
      { naam: 'Aanvraag', weergave: 'Aanvraag', type: 'lookup', doel: 'aanvragen', index: true },
      { naam: 'Start', weergave: 'Start', type: 'datum', index: true },
      { naam: 'DuurMinuten', weergave: 'Duur (minuten)', type: 'getal', standaard: '60' },
      { naam: 'DemoType', weergave: 'Type demo', type: 'lookup', doel: 'demoTypes' },
      { naam: 'AantalDeelnemers', weergave: 'Aantal deelnemers', type: 'getal' },
      { naam: 'BegeleidersNodig', weergave: 'Aantal begeleiders nodig', type: 'getal', standaard: '2' },
      { naam: 'Borrel', weergave: 'Borrel gewenst', type: 'keuze', keuzes: BORREL_OPTIES, standaard: 'onbekend' },
      { naam: 'Wedstrijd', weergave: 'Wedstrijd gewenst', type: 'keuze', keuzes: WEDSTRIJD_OPTIES, standaard: 'onbekend' },
      { naam: 'Prijsafspraak', weergave: 'Prijsafspraak', type: 'notitie' },
      { naam: 'Notitie', weergave: 'Notitie', type: 'notitie' },
      { naam: 'Planningsstatus', weergave: 'Planningsstatus', type: 'keuze', keuzes: PLANNINGSSTATUSSEN, standaard: 'Voorlopig' },
      { naam: 'EventIdDemo', weergave: 'Event-id demo', type: 'notitie' },
      { naam: 'EventIdOpbouwen', weergave: 'Event-id opbouwen', type: 'notitie' },
      { naam: 'EventIdOpruimen', weergave: 'Event-id opruimen', type: 'notitie' },
      { naam: 'LaatsteSyncOp', weergave: 'Laatste synchronisatie', type: 'datum' }
    ]
  },
  inzet: {
    url: 'Inzet',
    titel: 'Inzet',
    titleWeergave: undefined,
    velden: [
      { naam: 'Demo', weergave: 'Demo', type: 'lookup', doel: 'demos', index: true },
      { naam: 'Begeleider', weergave: 'Begeleider', type: 'lookup', doel: 'begeleiders', index: true },
      { naam: 'DuurMinuten', weergave: 'Duur (minuten)', type: 'getal' }
    ]
  },
  notities: {
    url: 'Notities',
    titel: 'Notities',
    titleWeergave: undefined,
    velden: [
      { naam: 'Aanvraag', weergave: 'Aanvraag', type: 'lookup', doel: 'aanvragen', index: true },
      { naam: 'Tekst', weergave: 'Tekst', type: 'notitie' }
    ]
  },
  statuswijzigingen: {
    url: 'Statuswijzigingen',
    titel: 'Statuswijzigingen',
    titleWeergave: undefined,
    velden: [
      { naam: 'Aanvraag', weergave: 'Aanvraag', type: 'lookup', doel: 'aanvragen', index: true },
      { naam: 'VanStatus', weergave: 'Van status', type: 'tekst' },
      { naam: 'NaarStatus', weergave: 'Naar status', type: 'tekst' }
    ]
  }
};

/** Volgorde van aanmaken: doellijsten van lookups eerst. */
export const AANMAAKVOLGORDE: LijstSleutel[] = [
  'begeleiders',
  'demoTypes',
  'standaardantwoorden',
  'instellingen',
  'aanvragen',
  'berichten',
  'demos',
  'inzet',
  'notities',
  'statuswijzigingen'
];
