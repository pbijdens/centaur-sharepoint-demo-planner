// Sorteren van het startscherm (FR-17, FR-18) en samenvoegen van aanvragen (FR-44). Alleen rekenwerk.

import { Aanvraag, STATUSSEN } from '../model';

export type AanvraagSortering = 'bericht' | 'demo' | 'status';

export const SORTERINGEN: { waarde: AanvraagSortering; label: string }[] = [
  { waarde: 'bericht', label: 'Laatste bericht' },
  { waarde: 'demo', label: 'Eerste demo' },
  { waarde: 'status', label: 'Status' }
];

/** Per aanvraag de start van de vroegste demo. */
export function eersteDemoPerAanvraag(demos: { aanvraagId: number; start: Date }[]): Record<number, Date> {
  const uit: Record<number, Date> = {};
  for (const d of demos) {
    const huidig = uit[d.aanvraagId];
    if (!huidig || d.start < huidig) uit[d.aanvraagId] = d.start;
  }
  return uit;
}

const tijdOf = (d: Date | undefined, leeg: number): number => (d ? d.getTime() : leeg);

/** Nieuwste laatste bericht eerst; aanvragen zonder bericht onderaan. */
function opBericht(a: Aanvraag, b: Aanvraag): number {
  return tijdOf(b.laatsteBerichtOp, -Infinity) - tijdOf(a.laatsteBerichtOp, -Infinity);
}

/** Sorteert een kopie van de lijst. Bij gelijke waarden beslist het laatste bericht. */
export function sorteerAanvragen(aanvragen: Aanvraag[], sortering: AanvraagSortering, eersteDemo: Record<number, Date>): Aanvraag[] {
  const lijst = aanvragen.slice();
  if (sortering === 'demo') {
    return lijst.sort((a, b) => tijdOf(eersteDemo[a.id], Infinity) - tijdOf(eersteDemo[b.id], Infinity) || opBericht(a, b));
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
