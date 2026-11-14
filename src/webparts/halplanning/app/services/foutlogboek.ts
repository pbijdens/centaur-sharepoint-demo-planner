// Schrijft foutmeldingen die de gebruiker te zien krijgt naar de lijst Foutmeldingen (NFR-09).
// Fouten bij het schrijven naar die lijst zelf worden nooit getoond of opnieuw gelogd (alleen de console),
// zodat er geen eindeloze lus kan ontstaan.

import { FoutBegrenzer, bewaarGrens, foutDetails } from '../logic/foutlog';
import { Repository } from './repository';

/** Waar de gebruiker was toen de fout optrad. */
export interface FoutContext {
  scherm?: string;
  aanvraagId?: number;
  tabblad?: string;
}

export interface FoutOmgeving {
  /** Bijvoorbeeld "Teams (ios)" of "SharePoint". */
  omgeving: string;
  versie: string;
}

class FoutLogboek {
  private readonly begrenzer = new FoutBegrenzer();
  private context: FoutContext = {};

  constructor(private readonly repo: Repository, private readonly omgeving: FoutOmgeving) {}

  zetContext(c: FoutContext, vervang: boolean): void {
    this.context = vervang ? { ...c } : { ...this.context, ...c };
  }

  log(melding: string, fout: unknown): void {
    if (!this.begrenzer.mag(melding, Date.now())) return;
    const d = foutDetails(fout);
    const c = this.context;
    const details = [
      d.details,
      '',
      'Locatie: ' + window.location.href,
      'Browser: ' + navigator.userAgent
    ].join('\n');
    this.repo
      .maakFoutmelding({
        melding,
        details,
        httpStatus: d.status,
        verzoek: d.verzoek,
        scherm: [c.scherm, c.tabblad].filter(x => !!x).join(' / '),
        aanvraagNr: c.aanvraagId,
        omgeving: this.omgeving.omgeving,
        versie: this.omgeving.versie
      })
      .then(() => this.repo.verwijderFoutmeldingenVoor(bewaarGrens(new Date())))
      .catch(e => console.warn('Halplanning: foutmelding kon niet worden vastgelegd.', e));
  }
}

let logboek: FoutLogboek | undefined;

/** Eenmalig bij het opstarten van het webonderdeel. */
export function startFoutLogboek(repo: Repository, omgeving: FoutOmgeving): void {
  logboek = new FoutLogboek(repo, omgeving);
}

/** Legt vast waar de gebruiker is; `vervang` wist eerst de vorige context (bij een ander scherm). */
export function zetFoutContext(c: FoutContext, vervang: boolean = false): void {
  if (logboek) logboek.zetContext(c, vervang);
}

/** Legt een aan de gebruiker getoonde fout vast. Gooit nooit en wacht nergens op. */
export function logFout(melding: string, fout: unknown): void {
  try {
    if (logboek) logboek.log(melding, fout);
  } catch (e) {
    console.warn('Halplanning: foutmelding kon niet worden vastgelegd.', e);
  }
}
