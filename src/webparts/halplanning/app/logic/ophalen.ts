// Berichten ophalen uit de gedeelde mailbox die (nog) niet in de app staan (FR-46).

import { Bericht } from '../model';

/** Een bericht zoals het in de gedeelde mailbox staat, los van Graph. */
export interface MailboxBericht {
  graphId: string;
  onderwerp: string;
  vanNaam: string;
  vanAdres: string;
  aan: string[];
  cc: string[];
  ontvangenOp?: Date;
  body: string;
  voorbeeld: string;
  conversationId: string;
  internetMessageId: string;
  webLink: string;
  heeftBijlagen: boolean;
}

/** Onderwerp voor een mail zonder onderwerp; de kolom Title is verplicht (FR-04). */
export const GEEN_ONDERWERP = '(geen onderwerp)';

/** Zelfde grens als de flow: een kolom met meerdere regels tekst houdt ongeveer 63.000 tekens. */
export const MAX_BODY_TEKENS = 60000;

/** Berichten tot zoveel dagen vóór het aanmaken van de aanvraag zijn standaard aangevinkt. */
export const MARGE_DAGEN = 14;

/**
 * De gevonden berichten die nog niet in de app staan: zonder dubbele, zonder berichten zonder InternetMessageId en
 * zonder berichten waarvan het id al bekend is (ook bij een andere aanvraag). Oudste eerst.
 */
export function ontbrekendeBerichten(gevonden: MailboxBericht[], bekendeIds: ReadonlySet<string>): MailboxBericht[] {
  const gezien: Record<string, boolean> = {};
  const uit: MailboxBericht[] = [];
  for (const b of gevonden) {
    const id = b.internetMessageId;
    if (!id || gezien[id] || bekendeIds.has(id)) continue;
    gezien[id] = true;
    uit.push(b);
  }
  const tijd = (b: MailboxBericht): number => (b.ontvangenOp ? b.ontvangenOp.getTime() : 0);
  return uit.sort((a, b) => tijd(a) - tijd(b));
}

/** Standaard aangevinkt: uit een conversatie die al bij de aanvraag hoort, of niet (veel) ouder dan de aanvraag. */
export function standaardGekozen(b: MailboxBericht, conversaties: string[], aanvraagGemaakt?: Date): boolean {
  if (b.conversationId && conversaties.indexOf(b.conversationId) >= 0) return true;
  if (!aanvraagGemaakt || !b.ontvangenOp) return true;
  return b.ontvangenOp.getTime() >= aanvraagGemaakt.getTime() - MARGE_DAGEN * 24 * 3600 * 1000;
}

/** Zet een bericht uit de mailbox om naar een bericht in de app. Uitgaand als de gedeelde mailbox de afzender is. */
export function naarAppBericht(b: MailboxBericht, aanvraagId: number, mailboxAdres: string): Omit<Bericht, 'id'> {
  const uitgaand = !!b.vanAdres && b.vanAdres.toLowerCase() === (mailboxAdres || '').toLowerCase();
  return {
    aanvraagId,
    onderwerp: b.onderwerp.trim() ? b.onderwerp : GEEN_ONDERWERP,
    richting: uitgaand ? 'Uitgaand' : 'Inkomend',
    vanNaam: b.vanNaam || b.vanAdres,
    vanAdres: b.vanAdres,
    aan: b.aan.join('; '),
    cc: b.cc.join('; '),
    ontvangenOp: b.ontvangenOp,
    body: b.body.length > MAX_BODY_TEKENS ? b.body.slice(0, MAX_BODY_TEKENS) : b.body,
    conversationId: b.conversationId,
    internetMessageId: b.internetMessageId,
    graphMessageId: b.graphId,
    outlookLink: b.webLink,
    heeftBijlagen: b.heeftBijlagen
  };
}

export interface AanvraagNaToevoegen {
  /** Het nieuwste toegevoegde inkomende bericht, alleen als dat later is dan de huidige waarde. */
  laatsteBerichtOp?: Date;
  /** True als het nieuwste bericht van de aanvraag een toegevoegd inkomend bericht is. */
  onbeantwoord: boolean;
}

/** Wat er op de aanvraag verandert na het toevoegen van berichten (FR-46). LaatsteBerichtOp telt alleen inkomend. */
export function aanvraagNaToevoegen(
  huidigLaatste: Date | undefined,
  bestaand: Pick<Bericht, 'ontvangenOp'>[],
  toegevoegd: Pick<Bericht, 'ontvangenOp' | 'richting'>[]
): AanvraagNaToevoegen {
  const tijd = (d?: Date): number => (d ? d.getTime() : 0);
  const inkomend = toegevoegd.filter(b => b.richting === 'Inkomend');
  if (inkomend.length === 0) return { onbeantwoord: false };
  const nieuwste = inkomend.reduce((max, b) => (tijd(b.ontvangenOp) > tijd(max.ontvangenOp) ? b : max));
  const anders = Math.max(
    0,
    ...bestaand.map(b => tijd(b.ontvangenOp)),
    ...toegevoegd.filter(b => b.richting !== 'Inkomend').map(b => tijd(b.ontvangenOp))
  );
  return {
    laatsteBerichtOp: tijd(nieuwste.ontvangenOp) > tijd(huidigLaatste) ? nieuwste.ontvangenOp : undefined,
    onbeantwoord: tijd(nieuwste.ontvangenOp) > anders
  };
}
