// Microsoft Graph, gedelegeerd als de ingelogde agent, voor de gedeelde mailbox en de agenda (B4).

import { MSGraphClientV3 } from '@microsoft/sp-http';
import { AgendaItem, EventPayload } from '../logic/agenda';
import { vanGraphDatumTijd } from '../logic/datum';
import { voegInNaBody } from '../logic/mail';
import { CATEGORIE_BEVESTIGD, CATEGORIE_DEMO, CATEGORIE_VOORLOPIG, GRAPH_TIJDZONE } from '../model';
import { foutStatus } from './sp';

export interface GraphAdres {
  emailAddress: { address: string; name?: string };
}

export interface GraphBericht {
  id: string;
  webLink?: string;
  conversationId?: string;
  internetMessageId?: string;
  hasAttachments?: boolean;
  from?: GraphAdres;
  body?: { contentType: string; content: string };
}

export interface GraphEvent {
  id: string;
  subject?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  isAllDay?: boolean;
  showAs?: string;
  categories?: string[];
  location?: { displayName?: string };
}

export interface Agenda {
  id: string;
  naam: string;
  kanBewerken: boolean;
  standaard: boolean;
}

export interface VerzondenBericht {
  conversationId: string;
  internetMessageId: string;
  graphMessageId: string;
}

const adressen = (lijst: string[]): GraphAdres[] => lijst.map(a => ({ emailAddress: { address: a } }));

export class GraphService {
  constructor(private readonly client: MSGraphClientV3, readonly mailboxAdres: string, readonly agendaId: string) {}

  private get mb(): string {
    return '/users/' + encodeURIComponent(this.mailboxAdres);
  }

  // ---- Toegang en instellingen ----

  /** Agenda's van de mailbox; faalt als de gebruiker geen toegang heeft. */
  static async agendas(client: MSGraphClientV3, mailboxAdres: string): Promise<Agenda[]> {
    const r = await client
      .api('/users/' + encodeURIComponent(mailboxAdres) + '/calendars')
      .select('id,name,canEdit,isDefaultCalendar')
      .top(100)
      .get();
    return (r.value as { id: string; name: string; canEdit: boolean; isDefaultCalendar: boolean }[]).map(a => ({
      id: a.id,
      naam: a.name,
      kanBewerken: a.canEdit,
      standaard: a.isDefaultCalendar
    }));
  }

  /** Controleert leestoegang tot het postvak van de mailbox. */
  static async testMailtoegang(client: MSGraphClientV3, mailboxAdres: string): Promise<void> {
    await client.api('/users/' + encodeURIComponent(mailboxAdres) + '/mailFolders/inbox').select('id').get();
  }

  // ---- E-mail ----

  /** Zoekt een bericht op InternetMessageId (stabiel, ook als het bericht naar een andere map is verplaatst). */
  async zoekBericht(internetMessageId: string): Promise<GraphBericht | undefined> {
    if (!internetMessageId) return undefined;
    const r = await this.client
      .api(this.mb + '/messages')
      .filter("internetMessageId eq '" + internetMessageId.replace(/'/g, "''") + "'")
      .select('id,webLink,conversationId,internetMessageId,hasAttachments,from')
      .top(1)
      .get();
    return (r.value as GraphBericht[])[0];
  }

  /**
   * Verstuurt "allen beantwoorden" op een bestaand bericht, vanuit de gedeelde mailbox. De agent heeft de
   * ontvangers al bepaald; de tekst komt boven de geciteerde oorspronkelijke mail.
   */
  async beantwoord(internetMessageId: string, html: string, aan: string[], cc: string[]): Promise<VerzondenBericht> {
    const origineel = await this.zoekBericht(internetMessageId);
    if (!origineel) throw new Error('Het oorspronkelijke bericht is niet gevonden in de gedeelde mailbox.');
    const concept = (await this.client.api(this.mb + '/messages/' + origineel.id + '/createReplyAll').post({})) as GraphBericht;
    try {
      await this.client.api(this.mb + '/messages/' + concept.id).patch({
        body: { contentType: 'HTML', content: voegInNaBody(concept.body ? concept.body.content : '', html) },
        toRecipients: adressen(aan),
        ccRecipients: adressen(cc)
      });
      return await this.verstuurConcept(concept.id);
    } catch (e) {
      await this.verwijderConcept(concept.id);
      throw e;
    }
  }

  /** Verstuurt een nieuwe e-mail vanuit de gedeelde mailbox (aanvraag zonder inkomend bericht, FR-36). */
  async nieuweMail(onderwerp: string, html: string, aan: string[], cc: string[]): Promise<VerzondenBericht> {
    const concept = (await this.client.api(this.mb + '/messages').post({
      subject: onderwerp,
      body: { contentType: 'HTML', content: html },
      toRecipients: adressen(aan),
      ccRecipients: adressen(cc)
    })) as GraphBericht;
    try {
      return await this.verstuurConcept(concept.id);
    } catch (e) {
      await this.verwijderConcept(concept.id);
      throw e;
    }
  }

  private async verstuurConcept(id: string): Promise<VerzondenBericht> {
    const info = (await this.client.api(this.mb + '/messages/' + id).select('conversationId,internetMessageId').get()) as GraphBericht;
    await this.client.api(this.mb + '/messages/' + id + '/send').post({});
    return { conversationId: info.conversationId || '', internetMessageId: info.internetMessageId || '', graphMessageId: '' };
  }

  private async verwijderConcept(id: string): Promise<void> {
    try {
      await this.client.api(this.mb + '/messages/' + id).delete();
    } catch {
      // Een achtergebleven concept is niet erg; de oorspronkelijke fout is belangrijker.
    }
  }

  // ---- Agenda ----

  private get agenda(): string {
    return this.mb + '/calendars/' + encodeURIComponent(this.agendaId);
  }

  /** Alle afspraken in [van, tot), inclusief hele-dag- en meerdaagse afspraken (FR-38). */
  async agendaItems(van: Date, tot: Date): Promise<AgendaItem[]> {
    const uit: AgendaItem[] = [];
    let r = await this.client
      .api(this.agenda + '/calendarView')
      .header('Prefer', 'outlook.timezone="' + GRAPH_TIJDZONE + '"')
      // Zonder offset leest Graph deze parameters als UTC; daarom het exacte tijdstip in UTC meegeven.
      .query({ startDateTime: van.toISOString(), endDateTime: tot.toISOString() })
      .select('id,subject,start,end,isAllDay,showAs,categories,location')
      .orderby('start/dateTime')
      .top(250)
      .get();
    for (;;) {
      for (const e of r.value as GraphEvent[]) {
        uit.push({
          id: e.id,
          onderwerp: e.subject || '(geen onderwerp)',
          start: vanGraphDatumTijd(e.start.dateTime),
          eind: vanGraphDatumTijd(e.end.dateTime),
          heleDag: !!e.isAllDay,
          showAs: e.showAs || '',
          categorieen: e.categories || [],
          locatie: (e.location && e.location.displayName) || ''
        });
      }
      const volgende = r['@odata.nextLink'] as string | undefined;
      if (!volgende) break;
      r = await this.client.api(volgende).header('Prefer', 'outlook.timezone="' + GRAPH_TIJDZONE + '"').get();
    }
    return uit;
  }

  async maakAfspraak(payload: EventPayload): Promise<string> {
    const e = (await this.client.api(this.agenda + '/events').post(payload)) as GraphEvent;
    return e.id;
  }

  /** Werkt een afspraak bij. Geeft false als de afspraak niet meer bestaat (FR-57). */
  async wijzigAfspraak(id: string, payload: EventPayload): Promise<boolean> {
    try {
      await this.client.api(this.mb + '/events/' + encodeURIComponent(id)).patch(payload);
      return true;
    } catch (e) {
      if (foutStatus(e) === 404) return false;
      throw e;
    }
  }

  /** Verwijdert een afspraak; een afspraak die al weg is, telt als verwijderd. */
  async verwijderAfspraak(id: string): Promise<void> {
    if (!id) return;
    try {
      await this.client.api(this.mb + '/events/' + encodeURIComponent(id)).delete();
    } catch (e) {
      if (foutStatus(e) !== 404) throw e;
    }
  }

  /**
   * Maakt de categorieën aan als ze ontbreken (FR-52). Graph staat dit met gedelegeerde rechten voor een
   * gedeelde mailbox mogelijk niet toe (risico R2); dan blijft het bij een waarschuwing in de console en
   * werken de afspraken gewoon met de categorienaam.
   */
  async zorgVoorCategorieen(): Promise<boolean> {
    const gewenst: [string, string][] = [
      [CATEGORIE_DEMO, 'preset4'],
      [CATEGORIE_VOORLOPIG, 'preset1'],
      [CATEGORIE_BEVESTIGD, 'preset7']
    ];
    try {
      const r = await this.client.api(this.mb + '/outlook/masterCategories').get();
      const bestaand = (r.value as { displayName: string }[]).map(c => c.displayName.toLowerCase());
      for (const [naam, kleur] of gewenst) {
        if (bestaand.indexOf(naam.toLowerCase()) < 0) {
          await this.client.api(this.mb + '/outlook/masterCategories').post({ displayName: naam, color: kleur });
        }
      }
      return true;
    } catch (e) {
      console.warn('Halplanning: categorieën konden niet worden gecontroleerd of aangemaakt.', e);
      return false;
    }
  }
}
