// Rekenwerk voor het scherm "Begeleiders indelen" (FR-63 t/m FR-65). Geen afhankelijkheden van UI of opslag.

import { Aanvraag, Begeleider, Demo, eindVan, Inzet, Status } from '../model';

/** Statussen waarvan de demo's in het indelingsscherm staan (FR-63). */
export const INDELING_STATUSSEN: Status[] = ['In afwachting', 'Bevestigd'];

/** Een wijziging die nog wordt opgeslagen: het scherm toont die alvast (optimistisch). */
export interface OpenWijziging {
  soort: 'toevoegen' | 'verwijderen';
  demoId: number;
  begeleiderId: number;
}

const vergelijkNaam = (a: string, b: string): number => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true });

/** Begeleiders op alfabetische volgorde (FR-65), zonder de invoer te wijzigen. */
export function opNaam<T extends { naam: string }>(lijst: T[]): T[] {
  return lijst.slice().sort((a, b) => vergelijkNaam(a.naam, b.naam));
}

/**
 * Vaste kleur per begeleider (FR-65): de positie in de lijst gesorteerd op id, dus op volgorde van aanmaken. Een
 * nieuwe begeleider verandert de kleur van de anderen niet. Na `aantalKleuren` begeleiders begint de reeks opnieuw.
 */
export function kleurIndex(begeleiders: Pick<Begeleider, 'id'>[], aantalKleuren: number): Record<number, number> {
  const uit: Record<number, number> = {};
  begeleiders
    .map(b => b.id)
    .sort((a, b) => a - b)
    .forEach((id, i) => (uit[id] = i % aantalKleuren));
  return uit;
}

/** Demo's voor het indelingsscherm: in de agenda, bij een aanvraag met een passende status, vanaf `vanaf`. */
export function demosVoorIndeling(demos: Demo[], aanvragen: Aanvraag[], vanaf?: Date): Demo[] {
  const status: Record<number, Status> = {};
  aanvragen.forEach(a => (status[a.id] = a.status));
  return demos
    .filter(d => !!d.eventIdDemo && INDELING_STATUSSEN.indexOf(status[d.aanvraagId]) >= 0)
    .filter(d => !vanaf || eindVan(d) > vanaf)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.id - b.id);
}

/** Ids van de begeleiders bij een demo, inclusief wijzigingen die nog worden opgeslagen (in volgorde). */
export function toegewezenIds(demoId: number, inzet: Inzet[], open: OpenWijziging[]): number[] {
  const ids = inzet.filter(i => i.demoId === demoId).map(i => i.begeleiderId);
  for (const w of open) {
    if (w.demoId !== demoId) continue;
    const n = ids.indexOf(w.begeleiderId);
    if (w.soort === 'toevoegen' && n < 0) ids.push(w.begeleiderId);
    if (w.soort === 'verwijderen' && n >= 0) ids.splice(n, 1);
  }
  return ids.filter((id, i) => ids.indexOf(id) === i);
}

/** Aantal plekken op het scherm: wat nodig is, maar nooit minder dan wie er al staat. */
export function aantalPlekken(nodig: number, toegewezen: number): number {
  return Math.max(nodig, toegewezen);
}

/** Andere demo's die in de tijd overlappen met `demo` en waar de begeleider al bij staat (FR-64). */
export function overlapVoor(
  demo: Pick<Demo, 'id' | 'start' | 'duurMinuten'>,
  begeleiderId: number,
  demos: Demo[],
  toegewezen: (demoId: number) => number[]
): Demo[] {
  const van = demo.start.getTime();
  const tot = eindVan(demo).getTime();
  return demos.filter(
    d => d.id !== demo.id && d.start.getTime() < tot && eindVan(d).getTime() > van && toegewezen(d.id).indexOf(begeleiderId) >= 0
  );
}

/** Groepeert demo's (al op tijd gesorteerd) per kalenderdag. */
export function perDag<T extends { start: Date }>(lijst: T[]): { dag: Date; items: T[] }[] {
  const uit: { dag: Date; items: T[] }[] = [];
  for (const x of lijst) {
    const dag = new Date(x.start.getFullYear(), x.start.getMonth(), x.start.getDate());
    const laatste = uit[uit.length - 1];
    if (laatste && laatste.dag.getTime() === dag.getTime()) laatste.items.push(x);
    else uit.push({ dag, items: [x] });
  }
  return uit;
}
