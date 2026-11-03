// Opbouw van agenda-afspraken voor een demo (FR-50 t/m FR-56) en indeling van de dagweergave (FR-38).

import {
  CATEGORIE_BEVESTIGD,
  CATEGORIE_DEMO,
  CATEGORIE_VOORLOPIG,
  Demo,
  eindVan,
  GRAPH_TIJDZONE,
  OPBOUW_MINUTEN,
  OPRUIM_MINUTEN
} from '../model';
import { naarGraphDatumTijd, plusMinuten } from './datum';
import { escapeHtml } from './mail';

export type AfspraakSoort = 'opbouwen' | 'demo' | 'opruimen';
export const AFSPRAAKSOORTEN: AfspraakSoort[] = ['opbouwen', 'demo', 'opruimen'];

/** Graph-eventvelden die de app beheert. */
export interface EventPayload {
  subject: string;
  body: { contentType: 'HTML'; content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location: { displayName: string };
  showAs: 'tentative' | 'busy';
  categories: string[];
  isReminderOn: boolean;
}

export interface DemoContext {
  demo: Pick<Demo, 'titel' | 'start' | 'duurMinuten' | 'aantalDeelnemers' | 'borrel' | 'planningsstatus' | 'begeleidersNodig'>;
  demoTypeNaam: string;
  begeleiderNamen: string[];
}

export const HELP_GEZOCHT = '*help gezocht*';

/** Locatie van de hoofdafspraak: namen van begeleiders, plus "*help gezocht*" bij onderbezetting (FR-55). */
export function locatieTekst(begeleiderNamen: string[], nodig: number): string {
  const delen = begeleiderNamen.slice();
  if (begeleiderNamen.length < nodig) delen.push(HELP_GEZOCHT);
  return delen.join(', ');
}

/** Beschrijving van de hoofdafspraak: type, deelnemers en borrel (FR-54). */
export function beschrijvingHtml(demoTypeNaam: string, aantalDeelnemers: number | undefined, borrel: string): string {
  return [
    'Type demo: ' + escapeHtml(demoTypeNaam || 'Onbekend'),
    'Aantal deelnemers: ' + (aantalDeelnemers === undefined || aantalDeelnemers === null ? 'onbekend' : aantalDeelnemers),
    'Borrel gewenst: ' + escapeHtml(borrel || 'onbekend')
  ].join('<br>');
}

function tijdvak(van: Date, tot: Date): Pick<EventPayload, 'start' | 'end'> {
  return {
    start: { dateTime: naarGraphDatumTijd(van), timeZone: GRAPH_TIJDZONE },
    end: { dateTime: naarGraphDatumTijd(tot), timeZone: GRAPH_TIJDZONE }
  };
}

/** De drie afspraken van een demo: opbouwen (30 min. ervoor), de demo zelf, opruimen (30 min. erna). */
export function afsprakenVoorDemo(ctx: DemoContext): Record<AfspraakSoort, EventPayload> {
  const { demo } = ctx;
  const definitief = demo.planningsstatus === 'Definitief';
  const showAs = definitief ? 'busy' : 'tentative';
  const eind = eindVan(demo);
  const titel = demo.titel || 'Demo';

  const demoAfspraak: EventPayload = {
    subject: titel,
    body: { contentType: 'HTML', content: beschrijvingHtml(ctx.demoTypeNaam, demo.aantalDeelnemers, demo.borrel) },
    ...tijdvak(demo.start, eind),
    location: { displayName: locatieTekst(ctx.begeleiderNamen, demo.begeleidersNodig) },
    showAs,
    categories: [definitief ? CATEGORIE_DEMO : CATEGORIE_VOORLOPIG],
    isReminderOn: false
  };

  const randCategorie = [definitief ? CATEGORIE_BEVESTIGD : CATEGORIE_VOORLOPIG];
  const opbouwen: EventPayload = {
    subject: 'Opbouwen demo – ' + titel,
    body: { contentType: 'HTML', content: '' },
    ...tijdvak(plusMinuten(demo.start, -OPBOUW_MINUTEN), demo.start),
    location: { displayName: '' },
    showAs,
    categories: randCategorie,
    isReminderOn: false
  };
  const opruimen: EventPayload = {
    subject: 'Opruimen demo – ' + titel,
    body: { contentType: 'HTML', content: '' },
    ...tijdvak(eind, plusMinuten(eind, OPRUIM_MINUTEN)),
    location: { displayName: '' },
    showAs,
    categories: randCategorie,
    isReminderOn: false
  };

  return { opbouwen, demo: demoAfspraak, opruimen };
}

// ---- Dagweergave ----

export interface AgendaItem {
  id: string;
  onderwerp: string;
  start: Date;
  eind: Date;
  heleDag: boolean;
  showAs: string;
  categorieen: string[];
  locatie: string;
}

export interface GeplaatstItem {
  item: AgendaItem;
  /** Minuten vanaf middernacht van de getoonde dag (afgekapt op 0..1440). */
  vanMin: number;
  totMin: number;
  kolom: number;
  kolommen: number;
}

/**
 * Plaatst getimede afspraken van één dag in kolommen, zodat overlappende afspraken naast elkaar staan.
 * Afspraken die elkaar (transitief) overlappen vormen een groep met een gedeeld aantal kolommen.
 */
export function plaatsItems(items: AgendaItem[], dag: Date): GeplaatstItem[] {
  const dagStart = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate()).getTime();
  const geplaatst: GeplaatstItem[] = items
    .filter(i => !i.heleDag)
    .map(item => ({
      item,
      vanMin: Math.max(0, Math.round((item.start.getTime() - dagStart) / 60000)),
      totMin: Math.min(1440, Math.round((item.eind.getTime() - dagStart) / 60000)),
      kolom: 0,
      kolommen: 1
    }))
    .filter(g => g.totMin > g.vanMin || g.totMin === g.vanMin)
    .sort((a, b) => a.vanMin - b.vanMin || b.totMin - a.totMin);

  let groep: GeplaatstItem[] = [];
  let groepEind = -1;
  const sluitGroep = (): void => {
    const n = groep.reduce((max, g) => Math.max(max, g.kolom + 1), 1);
    groep.forEach(g => (g.kolommen = n));
    groep = [];
  };

  for (const g of geplaatst) {
    const eind = Math.max(g.totMin, g.vanMin + 15);
    if (groep.length && g.vanMin >= groepEind) sluitGroep();
    // Kies de eerste kolom die vrij is op het starttijdstip.
    const bezet = groep.filter(x => Math.max(x.totMin, x.vanMin + 15) > g.vanMin).map(x => x.kolom);
    let kolom = 0;
    while (bezet.indexOf(kolom) >= 0) kolom++;
    g.kolom = kolom;
    groep.push(g);
    groepEind = Math.max(groepEind, eind);
  }
  if (groep.length) sluitGroep();
  return geplaatst;
}

/** Afspraken die (een deel van) de dag beslaan als hele dag, inclusief meerdaagse. */
export function heleDagItems(items: AgendaItem[]): AgendaItem[] {
  return items.filter(i => i.heleDag);
}
