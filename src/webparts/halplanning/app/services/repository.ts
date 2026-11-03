// Data-laag voor de SharePoint-lijsten (SPECIFICATION.md §6). Alle schrijfacties gebeuren met de
// rechten van de ingelogde gebruiker; wijzigingen van aanvragen en demo's met ETag-controle (NFR-05).

import { SPFI } from '@pnp/sp';
import { IList } from '@pnp/sp/lists';
import { LIJSTEN, LijstSleutel } from '../lists';
import { LijstDemo } from '../logic/aanvragen';
import {
  Aanvraag,
  Begeleider,
  Bericht,
  Borrel,
  Demo,
  DemoType,
  Inzet,
  Instellingen,
  LEGE_INSTELLINGEN,
  Notitie,
  Planningsstatus,
  Standaardantwoord,
  Status,
  Statuswijziging,
  Wedstrijd
} from '../model';

type Ruw = Record<string, unknown>;

const str = (r: Ruw, k: string): string => (r[k] === undefined || r[k] === null ? '' : String(r[k]));
const num = (r: Ruw, k: string): number | undefined => (typeof r[k] === 'number' ? (r[k] as number) : undefined);
const bool = (r: Ruw, k: string): boolean => r[k] === true;
const datum = (r: Ruw, k: string): Date | undefined => (r[k] ? new Date(String(r[k])) : undefined);
const persoon = (r: Ruw, k: string): string => {
  const p = r[k] as { Title?: string } | undefined;
  return p && p.Title ? p.Title : '';
};
const etag = (r: Ruw): string | undefined => (r['odata.etag'] as string) || (r['@odata.etag'] as string) || undefined;
const url = (r: Ruw, k: string): string => {
  const v = r[k] as { Url?: string } | undefined;
  return v && v.Url ? v.Url : '';
};

/** Escapet een waarde voor gebruik in een OData-filter. */
export function odata(s: string): string {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function inBlokken<T>(lijst: T[], grootte: number): T[][] {
  const uit: T[][] = [];
  for (let i = 0; i < lijst.length; i += grootte) uit.push(lijst.slice(i, i + grootte));
  return uit;
}

const AANVRAAG_VELDEN = ['Id', 'Title', 'Naam', 'Organisatie', 'Email', 'Telefoon', 'IBAN', 'Status', 'Onbeantwoord', 'LaatsteBerichtOp', 'Bron', 'Created'];
const BERICHT_VELDEN = ['Id', 'Title', 'AanvraagId', 'Richting', 'VanNaam', 'VanAdres', 'Aan', 'Cc', 'OntvangenOp', 'Body', 'ConversationId', 'InternetMessageId', 'GraphMessageId', 'OutlookLink', 'HeeftBijlagen', 'VerstuurdDoor'];
const DEMO_VELDEN = ['Id', 'Title', 'AanvraagId', 'Start', 'DuurMinuten', 'DemoTypeId', 'AantalDeelnemers', 'BegeleidersNodig', 'Borrel', 'Wedstrijd', 'Prijsafspraak', 'Notitie', 'Planningsstatus', 'EventIdDemo', 'EventIdOpbouwen', 'EventIdOpruimen', 'LaatsteSyncOp'];

function naarAanvraag(r: Ruw): Aanvraag {
  return {
    id: num(r, 'Id') as number,
    titel: str(r, 'Title'),
    naam: str(r, 'Naam'),
    organisatie: str(r, 'Organisatie'),
    email: str(r, 'Email'),
    telefoon: str(r, 'Telefoon'),
    iban: str(r, 'IBAN'),
    status: (str(r, 'Status') || 'Nieuw') as Status,
    onbeantwoord: bool(r, 'Onbeantwoord'),
    laatsteBerichtOp: datum(r, 'LaatsteBerichtOp'),
    bron: (str(r, 'Bron') || 'E-mail') as Aanvraag['bron'],
    gemaakt: datum(r, 'Created'),
    etag: etag(r)
  };
}

function naarBericht(r: Ruw): Bericht {
  return {
    id: num(r, 'Id') as number,
    aanvraagId: num(r, 'AanvraagId') as number,
    onderwerp: str(r, 'Title'),
    richting: (str(r, 'Richting') || 'Inkomend') as Bericht['richting'],
    vanNaam: str(r, 'VanNaam'),
    vanAdres: str(r, 'VanAdres'),
    aan: str(r, 'Aan'),
    cc: str(r, 'Cc'),
    ontvangenOp: datum(r, 'OntvangenOp'),
    body: str(r, 'Body'),
    conversationId: str(r, 'ConversationId'),
    internetMessageId: str(r, 'InternetMessageId'),
    graphMessageId: str(r, 'GraphMessageId'),
    outlookLink: url(r, 'OutlookLink'),
    heeftBijlagen: bool(r, 'HeeftBijlagen'),
    verstuurdDoor: str(r, 'VerstuurdDoor')
  };
}

function naarDemo(r: Ruw): Demo {
  return {
    id: num(r, 'Id') as number,
    aanvraagId: num(r, 'AanvraagId') as number,
    titel: str(r, 'Title'),
    start: datum(r, 'Start') || new Date(),
    duurMinuten: num(r, 'DuurMinuten') || 60,
    demoTypeId: num(r, 'DemoTypeId'),
    aantalDeelnemers: num(r, 'AantalDeelnemers'),
    begeleidersNodig: num(r, 'BegeleidersNodig') ?? 2,
    borrel: (str(r, 'Borrel') || 'onbekend') as Borrel,
    wedstrijd: (str(r, 'Wedstrijd') || 'onbekend') as Wedstrijd,
    prijsafspraak: str(r, 'Prijsafspraak'),
    notitie: str(r, 'Notitie'),
    planningsstatus: (str(r, 'Planningsstatus') || 'Voorlopig') as Planningsstatus,
    eventIdDemo: str(r, 'EventIdDemo'),
    eventIdOpbouwen: str(r, 'EventIdOpbouwen'),
    eventIdOpruimen: str(r, 'EventIdOpruimen'),
    laatsteSyncOp: datum(r, 'LaatsteSyncOp'),
    etag: etag(r)
  };
}

/** Velden van een aanvraag zoals ze naar SharePoint gaan. */
export function aanvraagVelden(a: Partial<Aanvraag>): Ruw {
  const v: Ruw = {};
  if (a.titel !== undefined) v.Title = a.titel;
  if (a.naam !== undefined) v.Naam = a.naam;
  if (a.organisatie !== undefined) v.Organisatie = a.organisatie;
  if (a.email !== undefined) v.Email = a.email;
  if (a.telefoon !== undefined) v.Telefoon = a.telefoon;
  if (a.iban !== undefined) v.IBAN = a.iban;
  if (a.status !== undefined) v.Status = a.status;
  if (a.onbeantwoord !== undefined) v.Onbeantwoord = a.onbeantwoord;
  if (a.laatsteBerichtOp !== undefined) v.LaatsteBerichtOp = a.laatsteBerichtOp ? a.laatsteBerichtOp.toISOString() : null;
  if (a.bron !== undefined) v.Bron = a.bron;
  return v;
}

export function demoVelden(d: Partial<Demo>): Ruw {
  const v: Ruw = {};
  if (d.titel !== undefined) v.Title = d.titel;
  if (d.aanvraagId !== undefined) v.AanvraagId = d.aanvraagId;
  if (d.start !== undefined) v.Start = d.start.toISOString();
  if (d.duurMinuten !== undefined) v.DuurMinuten = d.duurMinuten;
  if ('demoTypeId' in d) v.DemoTypeId = d.demoTypeId || null;
  if ('aantalDeelnemers' in d) v.AantalDeelnemers = d.aantalDeelnemers ?? null;
  if (d.begeleidersNodig !== undefined) v.BegeleidersNodig = d.begeleidersNodig;
  if (d.borrel !== undefined) v.Borrel = d.borrel;
  if (d.wedstrijd !== undefined) v.Wedstrijd = d.wedstrijd;
  if (d.prijsafspraak !== undefined) v.Prijsafspraak = d.prijsafspraak;
  if (d.notitie !== undefined) v.Notitie = d.notitie;
  if (d.planningsstatus !== undefined) v.Planningsstatus = d.planningsstatus;
  if (d.eventIdDemo !== undefined) v.EventIdDemo = d.eventIdDemo;
  if (d.eventIdOpbouwen !== undefined) v.EventIdOpbouwen = d.eventIdOpbouwen;
  if (d.eventIdOpruimen !== undefined) v.EventIdOpruimen = d.eventIdOpruimen;
  if (d.laatsteSyncOp !== undefined) v.LaatsteSyncOp = d.laatsteSyncOp ? d.laatsteSyncOp.toISOString() : null;
  return v;
}

export class Repository {
  private readonly webUrl: string;

  constructor(private readonly sp: SPFI, webServerRelativeUrl: string) {
    this.webUrl = webServerRelativeUrl.replace(/\/$/, '');
  }

  lijst(sleutel: LijstSleutel): IList {
    return this.sp.web.getList(this.webUrl + '/Lists/' + LIJSTEN[sleutel].url);
  }

  private async alle(sleutel: LijstSleutel, select: string[], filter?: string, orderBy?: [string, boolean], expand?: string[]): Promise<Ruw[]> {
    let q = this.lijst(sleutel).items.select(...select).top(5000);
    if (filter) q = q.filter(filter);
    if (orderBy) q = q.orderBy(orderBy[0], orderBy[1]);
    if (expand && expand.length) q = q.expand(...expand);
    return (await q()) as Ruw[];
  }

  private async maak(sleutel: LijstSleutel, velden: Ruw): Promise<number> {
    const r = (await this.lijst(sleutel).items.add(velden)) as Ruw;
    return (num(r, 'Id') ?? num(r, 'ID')) as number;
  }

  private async wijzig(sleutel: LijstSleutel, id: number, velden: Ruw, etagWaarde?: string): Promise<void> {
    await this.lijst(sleutel).items.getById(id).update(velden, etagWaarde || '*');
  }

  private async verwijder(sleutel: LijstSleutel, id: number): Promise<void> {
    // Naar de prullenbak van de site, zodat een beheerder kan herstellen.
    await this.lijst(sleutel).items.getById(id).recycle();
  }

  // ---- Aanvragen ----

  async aanvragen(statussen: Status[]): Promise<Aanvraag[]> {
    if (statussen.length === 0) return [];
    const filter = statussen.map(s => 'Status eq ' + odata(s)).join(' or ');
    const rijen = await this.alle('aanvragen', AANVRAAG_VELDEN, filter, ['LaatsteBerichtOp', false]);
    return rijen.map(naarAanvraag);
  }

  async aanvraag(id: number): Promise<Aanvraag> {
    const r = (await this.lijst('aanvragen').items.getById(id).select(...AANVRAAG_VELDEN)()) as Ruw;
    return naarAanvraag(r);
  }

  async aanvragenOpIds(ids: number[]): Promise<Aanvraag[]> {
    const uniek = ids.filter((id, i) => ids.indexOf(id) === i);
    const uit: Aanvraag[] = [];
    for (const blok of inBlokken(uniek, 40)) {
      const rijen = await this.alle('aanvragen', AANVRAAG_VELDEN, blok.map(id => 'Id eq ' + id).join(' or '));
      uit.push(...rijen.map(naarAanvraag));
    }
    return uit;
  }

  async maakAanvraag(a: Partial<Aanvraag>): Promise<number> {
    return this.maak('aanvragen', aanvraagVelden(a));
  }

  async wijzigAanvraag(id: number, a: Partial<Aanvraag>, etagWaarde?: string): Promise<void> {
    await this.wijzig('aanvragen', id, aanvraagVelden(a), etagWaarde);
  }

  async verwijderAanvraag(id: number): Promise<void> {
    await this.verwijder('aanvragen', id);
  }

  // ---- Berichten ----

  async berichten(aanvraagId: number): Promise<Bericht[]> {
    const rijen = await this.alle('berichten', BERICHT_VELDEN, 'AanvraagId eq ' + aanvraagId, ['OntvangenOp', true]);
    return rijen.map(naarBericht);
  }

  async maakBericht(b: Omit<Bericht, 'id'>): Promise<number> {
    return this.maak('berichten', {
      Title: (b.onderwerp || '').slice(0, 255),
      AanvraagId: b.aanvraagId,
      Richting: b.richting,
      VanNaam: b.vanNaam,
      VanAdres: b.vanAdres,
      Aan: b.aan,
      Cc: b.cc,
      OntvangenOp: (b.ontvangenOp || new Date()).toISOString(),
      Body: b.body,
      ConversationId: b.conversationId,
      InternetMessageId: b.internetMessageId,
      GraphMessageId: b.graphMessageId,
      OutlookLink: b.outlookLink ? { Url: b.outlookLink, Description: 'Openen in Outlook' } : null,
      HeeftBijlagen: b.heeftBijlagen,
      VerstuurdDoor: b.verstuurdDoor || ''
    });
  }

  async wijzigBericht(id: number, v: { aanvraagId?: number; vanNaam?: string; outlookLink?: string; graphMessageId?: string }): Promise<void> {
    const velden: Ruw = {};
    if (v.aanvraagId !== undefined) velden.AanvraagId = v.aanvraagId;
    if (v.vanNaam !== undefined) velden.VanNaam = v.vanNaam;
    if (v.graphMessageId !== undefined) velden.GraphMessageId = v.graphMessageId;
    if (v.outlookLink !== undefined) velden.OutlookLink = { Url: v.outlookLink, Description: 'Openen in Outlook' };
    await this.wijzig('berichten', id, velden);
  }

  async verwijderBericht(id: number): Promise<void> {
    await this.verwijder('berichten', id);
  }

  // ---- Demo's ----

  async demos(aanvraagId: number): Promise<Demo[]> {
    const rijen = await this.alle('demos', DEMO_VELDEN, 'AanvraagId eq ' + aanvraagId, ['Start', true]);
    return rijen.map(naarDemo);
  }

  async demo(id: number): Promise<Demo> {
    return naarDemo((await this.lijst('demos').items.getById(id).select(...DEMO_VELDEN)()) as Ruw);
  }

  async demosInPeriode(van: Date, tot: Date): Promise<Demo[]> {
    const filter = 'Start ge ' + odata(van.toISOString()) + ' and Start lt ' + odata(tot.toISOString());
    const rijen = await this.alle('demos', DEMO_VELDEN, filter, ['Start', true]);
    return rijen.map(naarDemo);
  }

  /** Alle demo's en de inzet daarop, voor de sortering en de markeringen op het startscherm (FR-17 t/m FR-19). */
  async demosVoorLijst(): Promise<{ demos: LijstDemo[]; inzet: { demoId: number }[] }> {
    const [rijen, inzet] = await Promise.all([
      this.alle('demos', ['Id', 'AanvraagId', 'Start', 'DuurMinuten', 'BegeleidersNodig', 'EventIdDemo']),
      this.alle('inzet', ['DemoId'])
    ]);
    return {
      demos: rijen.filter(r => num(r, 'AanvraagId') !== undefined && r.Start).map(naarDemo),
      inzet: inzet.filter(r => num(r, 'DemoId') !== undefined).map(r => ({ demoId: num(r, 'DemoId') as number }))
    };
  }

  async maakDemo(d: Partial<Demo>): Promise<number> {
    return this.maak('demos', demoVelden(d));
  }

  async wijzigDemo(id: number, d: Partial<Demo>, etagWaarde?: string): Promise<void> {
    await this.wijzig('demos', id, demoVelden(d), etagWaarde);
  }

  async verwijderDemo(id: number): Promise<void> {
    await this.verwijder('demos', id);
  }

  // ---- Inzet ----

  async inzetVoorDemos(demoIds: number[]): Promise<Inzet[]> {
    const uit: Inzet[] = [];
    for (const blok of inBlokken(demoIds, 40)) {
      const rijen = await this.alle('inzet', ['Id', 'DemoId', 'BegeleiderId', 'DuurMinuten'], blok.map(id => 'DemoId eq ' + id).join(' or '));
      uit.push(
        ...rijen.map(r => ({
          id: num(r, 'Id') as number,
          demoId: num(r, 'DemoId') as number,
          begeleiderId: num(r, 'BegeleiderId') as number,
          duurMinuten: num(r, 'DuurMinuten')
        }))
      );
    }
    return uit;
  }

  async maakInzet(i: Omit<Inzet, 'id'>): Promise<number> {
    return this.maak('inzet', { DemoId: i.demoId, BegeleiderId: i.begeleiderId, DuurMinuten: i.duurMinuten ?? null });
  }

  async wijzigInzet(id: number, duurMinuten: number | undefined): Promise<void> {
    await this.wijzig('inzet', id, { DuurMinuten: duurMinuten ?? null });
  }

  async verwijderInzet(id: number): Promise<void> {
    await this.verwijder('inzet', id);
  }

  // ---- Stamgegevens ----

  async begeleiders(): Promise<Begeleider[]> {
    const rijen = await this.alle('begeleiders', ['Id', 'Title', 'Telefoon', 'Email', 'Actief'], undefined, ['Title', true]);
    return rijen.map(r => ({ id: num(r, 'Id') as number, naam: str(r, 'Title'), telefoon: str(r, 'Telefoon'), email: str(r, 'Email'), actief: bool(r, 'Actief') }));
  }

  async bewaarBegeleider(b: Omit<Begeleider, 'id'> & { id?: number }): Promise<void> {
    const velden = { Title: b.naam, Telefoon: b.telefoon, Email: b.email, Actief: b.actief };
    if (b.id) await this.wijzig('begeleiders', b.id, velden);
    else await this.maak('begeleiders', velden);
  }

  async verwijderBegeleider(id: number): Promise<void> {
    await this.verwijder('begeleiders', id);
  }

  async demoTypes(): Promise<DemoType[]> {
    const rijen = await this.alle('demoTypes', ['Id', 'Title', 'Volgorde', 'Actief'], undefined, ['Volgorde', true]);
    return rijen.map(r => ({ id: num(r, 'Id') as number, naam: str(r, 'Title'), volgorde: num(r, 'Volgorde') || 0, actief: bool(r, 'Actief') }));
  }

  async bewaarDemoType(t: Omit<DemoType, 'id'> & { id?: number }): Promise<void> {
    const velden = { Title: t.naam, Volgorde: t.volgorde, Actief: t.actief };
    if (t.id) await this.wijzig('demoTypes', t.id, velden);
    else await this.maak('demoTypes', velden);
  }

  async verwijderDemoType(id: number): Promise<void> {
    await this.verwijder('demoTypes', id);
  }

  async standaardantwoorden(): Promise<Standaardantwoord[]> {
    const rijen = await this.alle('standaardantwoorden', ['Id', 'Title', 'Tekst', 'Volgorde'], undefined, ['Volgorde', true]);
    return rijen.map(r => ({ id: num(r, 'Id') as number, titel: str(r, 'Title'), tekst: str(r, 'Tekst'), volgorde: num(r, 'Volgorde') || 0 }));
  }

  async bewaarStandaardantwoord(s: Omit<Standaardantwoord, 'id'> & { id?: number }): Promise<void> {
    const velden = { Title: s.titel, Tekst: s.tekst, Volgorde: s.volgorde };
    if (s.id) await this.wijzig('standaardantwoorden', s.id, velden);
    else await this.maak('standaardantwoorden', velden);
  }

  async verwijderStandaardantwoord(id: number): Promise<void> {
    await this.verwijder('standaardantwoorden', id);
  }

  // ---- Notities en geschiedenis ----

  async notities(aanvraagId: number): Promise<Notitie[]> {
    const rijen = await this.alle(
      'notities',
      ['Id', 'AanvraagId', 'Tekst', 'Created', 'Modified', 'Author/Title', 'Editor/Title'],
      'AanvraagId eq ' + aanvraagId,
      ['Created', true],
      ['Author', 'Editor']
    );
    return rijen.map(r => {
      const gemaakt = datum(r, 'Created');
      const gewijzigd = datum(r, 'Modified');
      // Aanmaken en wijzigen vallen binnen enkele seconden samen als er niets gewijzigd is.
      const isGewijzigd = !!gemaakt && !!gewijzigd && gewijzigd.getTime() - gemaakt.getTime() > 5000;
      return {
        id: num(r, 'Id') as number,
        aanvraagId,
        tekst: str(r, 'Tekst'),
        auteur: persoon(r, 'Author'),
        gemaakt,
        gewijzigd: isGewijzigd ? gewijzigd : undefined,
        gewijzigdDoor: isGewijzigd ? persoon(r, 'Editor') : undefined,
        etag: etag(r)
      };
    });
  }

  async maakNotitie(aanvraagId: number, tekst: string): Promise<void> {
    await this.maak('notities', { AanvraagId: aanvraagId, Tekst: tekst });
  }

  async wijzigNotitie(id: number, tekst: string, etagWaarde?: string): Promise<void> {
    await this.wijzig('notities', id, { Tekst: tekst }, etagWaarde);
  }

  async verwijderNotitie(id: number): Promise<void> {
    await this.verwijder('notities', id);
  }

  async statuswijzigingen(aanvraagId: number): Promise<Statuswijziging[]> {
    const rijen = await this.alle('statuswijzigingen', ['Id', 'VanStatus', 'NaarStatus', 'Created', 'Author/Title'], 'AanvraagId eq ' + aanvraagId, ['Created', false], ['Author']);
    return rijen.map(r => ({ id: num(r, 'Id') as number, aanvraagId, van: str(r, 'VanStatus'), naar: str(r, 'NaarStatus'), door: persoon(r, 'Author'), op: datum(r, 'Created') }));
  }

  async logStatuswijziging(aanvraagId: number, van: string, naar: string): Promise<void> {
    await this.maak('statuswijzigingen', { AanvraagId: aanvraagId, VanStatus: van, NaarStatus: naar });
  }

  /** Koppelt alle items van een lijst die naar `van` verwijzen aan `naar` (samenvoegen, FR-44). */
  async verplaatsNaarAanvraag(sleutel: 'berichten' | 'demos' | 'notities' | 'statuswijzigingen', van: number, naar: number): Promise<number> {
    const rijen = await this.alle(sleutel, ['Id'], 'AanvraagId eq ' + van);
    for (const r of rijen) await this.wijzig(sleutel, num(r, 'Id') as number, { AanvraagId: naar });
    return rijen.length;
  }

  /** Verwijdert alle items van een lijst die naar de aanvraag verwijzen. */
  async verwijderVanAanvraag(sleutel: 'berichten' | 'notities' | 'statuswijzigingen', aanvraagId: number): Promise<void> {
    const rijen = await this.alle(sleutel, ['Id'], 'AanvraagId eq ' + aanvraagId);
    for (const r of rijen) await this.verwijder(sleutel, num(r, 'Id') as number);
  }

  // ---- Instellingen ----

  async instellingen(): Promise<Instellingen> {
    const rijen = await this.alle('instellingen', ['Id', 'Title', 'Waarde']);
    const map: Record<string, string> = {};
    rijen.forEach(r => (map[str(r, 'Title')] = str(r, 'Waarde')));
    return {
      ...LEGE_INSTELLINGEN,
      handtekening: map.Handtekening || '',
      mailboxAdres: map.MailboxAdres || '',
      agendaId: map.AgendaId || '',
      agendaNaam: map.AgendaNaam || ''
    };
  }

  async zetInstelling(sleutel: 'Handtekening' | 'MailboxAdres' | 'AgendaId' | 'AgendaNaam', waarde: string): Promise<void> {
    const rijen = await this.alle('instellingen', ['Id'], 'Title eq ' + odata(sleutel));
    if (rijen.length) await this.wijzig('instellingen', num(rijen[0], 'Id') as number, { Waarde: waarde });
    else await this.maak('instellingen', { Title: sleutel, Waarde: waarde });
  }
}
