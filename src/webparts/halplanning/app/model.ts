// Domeinmodel en vaste waarden van Halplanning. Zie SPECIFICATION.md §4 en §6.

export const STATUSSEN = [
  'Nieuw',
  'In afwachting',
  'Bevestigd',
  'Klaar voor facturatie',
  'Gesloten',
  'Verwijderd'
] as const;
export type Status = typeof STATUSSEN[number];

/** Statussen waarbij nieuwe e-mail nog automatisch aan de aanvraag wordt gekoppeld (FR-03). */
export const OPEN_STATUSSEN: Status[] = ['Nieuw', 'In afwachting', 'Bevestigd', 'Klaar voor facturatie'];

export const BORREL_OPTIES = ['geen', 'vooraf', 'achteraf', 'beide', 'patat met snack achteraf', 'onbekend'] as const;
export type Borrel = typeof BORREL_OPTIES[number];

export const WEDSTRIJD_OPTIES = ['ja', 'nee', 'onbekend'] as const;
export type Wedstrijd = typeof WEDSTRIJD_OPTIES[number];

export const PLANNINGSSTATUSSEN = ['Voorlopig', 'Definitief'] as const;
export type Planningsstatus = typeof PLANNINGSSTATUSSEN[number];

export const DEMOTYPES_BEGIN = [
  'Feest met barbecue',
  'Feest met koud buffet',
  'Bedrijfsdemo',
  'Privé demo',
  'Schoolklas',
  'Kinderfeestje',
  'Privéles',
  'Onbekend'
];

// Vaste waarden, bewust niet instelbaar (zie §6 Instellingen).
export const OPBOUW_MINUTEN = 30;
export const OPRUIM_MINUTEN = 30;
export const STANDAARD_DUUR_MINUTEN = 60;
export const STANDAARD_BEGELEIDERS = 2;
export const CATEGORIE_VOORLOPIG = 'Gereserveerd';
export const CATEGORIE_DEMO = 'Demo';
export const CATEGORIE_BEVESTIGD = 'Gereserveerd (bevestigd)';
/** Windows-tijdzonenaam zoals Exchange/Graph die verwacht. */
export const GRAPH_TIJDZONE = 'W. Europe Standard Time';

export interface Aanvraag {
  id: number;
  titel: string;
  naam: string;
  organisatie: string;
  email: string;
  telefoon: string;
  iban: string;
  status: Status;
  onbeantwoord: boolean;
  laatsteBerichtOp?: Date;
  bron: 'E-mail' | 'Handmatig';
  gemaakt?: Date;
  etag?: string;
}

export interface Bericht {
  id: number;
  aanvraagId: number;
  onderwerp: string;
  richting: 'Inkomend' | 'Uitgaand';
  vanNaam: string;
  vanAdres: string;
  aan: string;
  cc: string;
  ontvangenOp?: Date;
  body: string;
  conversationId: string;
  internetMessageId: string;
  graphMessageId: string;
  outlookLink: string;
  heeftBijlagen: boolean;
  verstuurdDoor?: string;
}

export interface Demo {
  id: number;
  aanvraagId: number;
  titel: string;
  start: Date;
  duurMinuten: number;
  demoTypeId?: number;
  aantalDeelnemers?: number;
  begeleidersNodig: number;
  borrel: Borrel;
  wedstrijd: Wedstrijd;
  prijsafspraak: string;
  notitie: string;
  planningsstatus: Planningsstatus;
  eventIdDemo: string;
  eventIdOpbouwen: string;
  eventIdOpruimen: string;
  laatsteSyncOp?: Date;
  etag?: string;
}

export interface Inzet {
  id: number;
  demoId: number;
  begeleiderId: number;
  /** Leeg = de duur van de demo. */
  duurMinuten?: number;
}

export interface Begeleider {
  id: number;
  naam: string;
  telefoon: string;
  email: string;
  actief: boolean;
}

export interface DemoType {
  id: number;
  naam: string;
  volgorde: number;
  actief: boolean;
}

export interface Standaardantwoord {
  id: number;
  titel: string;
  tekst: string;
  volgorde: number;
}

export interface Notitie {
  id: number;
  aanvraagId: number;
  tekst: string;
  auteur: string;
  gemaakt?: Date;
  /** Alleen gevuld als de notitie na het aanmaken is gewijzigd (FR-42). */
  gewijzigd?: Date;
  gewijzigdDoor?: string;
  etag?: string;
}

export interface Statuswijziging {
  id: number;
  aanvraagId: number;
  van: string;
  naar: string;
  door: string;
  op?: Date;
}

export interface Instellingen {
  handtekening: string;
  mailboxAdres: string;
  agendaId: string;
  agendaNaam: string;
}

export const LEGE_INSTELLINGEN: Instellingen = { handtekening: '', mailboxAdres: '', agendaId: '', agendaNaam: '' };

export function isOpen(status: Status): boolean {
  return OPEN_STATUSSEN.indexOf(status) >= 0;
}

export function eindVan(demo: Pick<Demo, 'start' | 'duurMinuten'>): Date {
  return new Date(demo.start.getTime() + demo.duurMinuten * 60000);
}
