// Sorteren van het startscherm (FR-17, FR-18) en samenvoegen van aanvragen (FR-44). Alleen rekenwerk.

import { Aanvraag, STATUSSEN } from '../model';

export type AanvraagSortering = 'bericht' | 'demo' | 'status';

export const SORTERINGEN: { waarde: AanvraagSortering; label: string }[] = [
  { waarde: 'bericht', label: 'Laatste bericht' },
  { waarde: 'demo', label: 'Eerstvolgende demo' },
  { waarde: 'status', label: 'Status' }
];

/** Wat het startscherm van een demo nodig heeft. */
export interface LijstDemo {
  id: number;
  aanvraagId: number;
  start: Date;
  duurMinuten: number;
  begeleidersNodig: number;
  eventIdDemo: string;
}

/** Samenvatting van de demo's van één aanvraag voor het startscherm (FR-18, FR-19). */
export interface DemoOverzicht {
  aantal: number;
  /** Start van de vroegste demo die nog niet voorbij is. */
  volgende?: Date;
  /** Start van de laatste demo; alleen van belang als er geen volgende is. */
  laatste?: Date;
  /** Aantal demo's die nog niet voorbij zijn en niet in de agenda staan. */
  nietInAgenda: number;
  /** Aantal demo's die nog niet voorbij zijn en te weinig begeleiders hebben. */
  tekortBegeleiders: number;
}

/** Per aanvraag een samenvatting van de demo's. Een demo is voorbij zodra hij is afgelopen. */
export function demoOverzichtPerAanvraag(demos: LijstDemo[], inzet: { demoId: number }[], nu: Date): Record<number, DemoOverzicht> {
  const toegewezen: Record<number, number> = {};
  for (const i of inzet) toegewezen[i.demoId] = (toegewezen[i.demoId] || 0) + 1;
  const uit: Record<number, DemoOverzicht> = {};
  for (const d of demos) {
    const o = uit[d.aanvraagId] || (uit[d.aanvraagId] = { aantal: 0, nietInAgenda: 0, tekortBegeleiders: 0 });
    o.aantal++;
    if (!o.laatste || d.start > o.laatste) o.laatste = d.start;
    if (d.start.getTime() + d.duurMinuten * 60000 <= nu.getTime()) continue;
    if (!o.volgende || d.start < o.volgende) o.volgende = d.start;
    if (!d.eventIdDemo) o.nietInAgenda++;
    if ((toegewezen[d.id] || 0) < d.begeleidersNodig) o.tekortBegeleiders++;
  }
  return uit;
}

const tijdOf = (d: Date | undefined, leeg: number): number => (d ? d.getTime() : leeg);

/** Nieuwste laatste bericht eerst; aanvragen zonder bericht onderaan. */
function opBericht(a: Aanvraag, b: Aanvraag): number {
  return tijdOf(b.laatsteBerichtOp, -Infinity) - tijdOf(a.laatsteBerichtOp, -Infinity);
}

/**
 * Sorteert een kopie van de lijst. Bij gelijke waarden beslist het laatste bericht. Op eerstvolgende demo komen
 * aanvragen zonder komende demo onderaan, daarbinnen op laatste bericht.
 */
export function sorteerAanvragen(aanvragen: Aanvraag[], sortering: AanvraagSortering, overzicht: Record<number, DemoOverzicht>): Aanvraag[] {
  const lijst = aanvragen.slice();
  if (sortering === 'demo') {
    const volgende = (a: Aanvraag): number => tijdOf(overzicht[a.id] && overzicht[a.id].volgende, Infinity);
    return lijst.sort((a, b) => volgende(a) - volgende(b) || opBericht(a, b));
  }
  if (sortering === 'status') {
    return lijst.sort((a, b) => STATUSSEN.indexOf(a.status) - STATUSSEN.indexOf(b.status) || opBericht(a, b));
  }
  return lijst.sort(opBericht);
}

export type Klantveld = 'naam' | 'organisatie' | 'email' | 'telefoon' | 'iban';

const KLANTVELDEN: { veld: Klantveld; label: string }[] = [
  { veld: 'naam', label: 'Naam' },
  { veld: 'organisatie', label: 'Organisatie' },
  { veld: 'email', label: 'E-mailadres' },
  { veld: 'telefoon', label: 'Telefoon' },
  { veld: 'iban', label: 'IBAN' }
];

export interface Samenvoeging {
  /** Wijziging voor de doelaanvraag. */
  wijziging: Partial<Aanvraag>;
  /** Tekst voor de notitie bij het doel. */
  notitie: string;
}

/**
 * Bepaalt hoe de doelaanvraag verandert als `bron` erin opgaat (FR-44): lege klantgegevens aanvullen,
 * afwijkende gegevens alleen noemen in de notitie, onbeantwoord en laatste bericht combineren.
 */
export function samenvoeging(doel: Aanvraag, bron: Aanvraag): Samenvoeging {
  const wijziging: Partial<Aanvraag> = {};
  const afwijkend: string[] = [];
  for (const { veld, label } of KLANTVELDEN) {
    const vanBron = (bron[veld] || '').trim();
    const vanDoel = (doel[veld] || '').trim();
    if (!vanBron) continue;
    if (!vanDoel) wijziging[veld] = vanBron;
    else if (vanBron.toLowerCase() !== vanDoel.toLowerCase()) afwijkend.push(label + ': ' + vanBron);
  }
  if (bron.onbeantwoord && !doel.onbeantwoord) wijziging.onbeantwoord = true;
  if (bron.laatsteBerichtOp && (!doel.laatsteBerichtOp || bron.laatsteBerichtOp > doel.laatsteBerichtOp)) {
    wijziging.laatsteBerichtOp = bron.laatsteBerichtOp;
  }

  const titel = bron.titel || bron.naam || bron.email || 'zonder titel';
  let notitie = 'Aanvraag “' + titel + '” (status ' + bron.status + ') is samengevoegd met deze aanvraag.';
  if (afwijkend.length) notitie += '\nAfwijkende gegevens van die aanvraag:\n' + afwijkend.join('\n');
  return { wijziging, notitie };
}
