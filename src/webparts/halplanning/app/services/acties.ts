// Samengestelde acties die SharePoint en Graph combineren.

import { afsprakenVoorDemo, AfspraakSoort, AFSPRAAKSOORTEN } from '../logic/agenda';
import { samenvoeging } from '../logic/aanvragen';
import { antwoordHtml, parseAdressen } from '../logic/mail';
import {
  Aanvraag,
  Bericht,
  Demo,
  STANDAARD_BEGELEIDERS,
  STANDAARD_DUUR_MINUTEN,
  Status
} from '../model';
import { GraphService } from './graph';
import { Repository } from './repository';

const EVENT_VELD: Record<AfspraakSoort, 'eventIdOpbouwen' | 'eventIdDemo' | 'eventIdOpruimen'> = {
  opbouwen: 'eventIdOpbouwen',
  demo: 'eventIdDemo',
  opruimen: 'eventIdOpruimen'
};

export interface SyncResultaat {
  /** Afspraken die in de agenda niet meer bestonden en niet opnieuw zijn aangemaakt. */
  ontbrekend: AfspraakSoort[];
}

export class Acties {
  constructor(
    private readonly repo: Repository,
    private readonly graph: GraphService,
    private readonly gebruikersnaam: string
  ) {}

  // ---- Status ----

  /** Wijzigt de status en legt de wijziging vast. Bij "Verwijderd" gaan de agenda-afspraken weg (FR-21). */
  async wijzigStatus(aanvraag: Aanvraag, naar: Status): Promise<void> {
    if (aanvraag.status === naar) return;
    if (naar === 'Verwijderd') await this.verwijderAfsprakenVanAanvraag(aanvraag.id);
    await this.repo.wijzigAanvraag(aanvraag.id, { status: naar }, aanvraag.etag);
    await this.repo.logStatuswijziging(aanvraag.id, aanvraag.status, naar);
  }

  async markeerVerwerkt(aanvraag: Aanvraag, verwerkt: boolean = true): Promise<void> {
    await this.repo.wijzigAanvraag(aanvraag.id, { onbeantwoord: !verwerkt }, aanvraag.etag);
  }

  // ---- Demo's en agenda ----

  /** Context voor de agenda-afspraken: typenaam en namen van de toegewezen begeleiders. */
  private async demoContext(demo: Demo): Promise<{ demoTypeNaam: string; begeleiderNamen: string[] }> {
    const [types, inzet, begeleiders] = await Promise.all([
      this.repo.demoTypes(),
      this.repo.inzetVoorDemos([demo.id]),
      this.repo.begeleiders()
    ]);
    const type = types.filter(t => t.id === demo.demoTypeId)[0];
    const namen = inzet
      .map(i => begeleiders.filter(b => b.id === i.begeleiderId)[0])
      .filter(b => !!b)
      .map(b => b.naam);
    return { demoTypeNaam: type ? type.naam : 'Onbekend', begeleiderNamen: namen };
  }

  /**
   * Zet de drie afspraken van een demo gelijk met de gegevens in de app (push, FR-56). Ontbrekende afspraken
   * worden alleen opnieuw aangemaakt als `herstel` aan staat (FR-57).
   */
  async synchroniseerDemo(demoId: number, herstel: boolean = false): Promise<SyncResultaat> {
    const demo = await this.repo.demo(demoId);
    const ctx = await this.demoContext(demo);
    const payloads = afsprakenVoorDemo({ demo, ...ctx });
    const wijziging: Partial<Demo> = {};
    const ontbrekend: AfspraakSoort[] = [];

    for (const soort of AFSPRAAKSOORTEN) {
      const veld = EVENT_VELD[soort];
      const id = demo[veld];
      if (id) {
        const bestaat = await this.graph.wijzigAfspraak(id, payloads[soort]);
        if (bestaat) continue;
        if (!herstel) {
          ontbrekend.push(soort);
          continue;
        }
      }
      wijziging[veld] = await this.graph.maakAfspraak(payloads[soort]);
    }
    wijziging.laatsteSyncOp = new Date();
    await this.repo.wijzigDemo(demo.id, wijziging);
    return { ontbrekend };
  }

  /** In potlood zetten (FR-50): demo aanmaken als Voorlopig met drie voorlopige afspraken. */
  async planDemo(aanvraag: Aanvraag, start: Date, duurMinuten: number = STANDAARD_DUUR_MINUTEN, extra: Partial<Demo> = {}): Promise<number> {
    const id = await this.repo.maakDemo({
      titel: aanvraag.titel || aanvraag.naam,
      begeleidersNodig: STANDAARD_BEGELEIDERS,
      borrel: 'onbekend',
      wedstrijd: 'onbekend',
      ...extra,
      aanvraagId: aanvraag.id,
      start,
      duurMinuten,
      planningsstatus: 'Voorlopig'
    });
    await this.graph.zorgVoorCategorieen();
    await this.synchroniseerDemo(id, true);
    return id;
  }

  /** Wijzigt een demo en werkt de agenda bij. */
  async wijzigDemo(demo: Demo, wijziging: Partial<Demo>): Promise<SyncResultaat> {
    await this.repo.wijzigDemo(demo.id, wijziging, demo.etag);
    return this.synchroniseerDemo(demo.id);
  }

  /** Definitief maken (FR-51). */
  async maakDefinitief(demo: Demo, start: Date, duurMinuten: number): Promise<SyncResultaat> {
    await this.graph.zorgVoorCategorieen();
    return this.wijzigDemo(demo, { start, duurMinuten, planningsstatus: 'Definitief' });
  }

  async verwijderAfsprakenVanDemo(demo: Demo): Promise<void> {
    for (const soort of AFSPRAAKSOORTEN) await this.graph.verwijderAfspraak(demo[EVENT_VELD[soort]]);
    await this.repo.wijzigDemo(demo.id, { eventIdDemo: '', eventIdOpbouwen: '', eventIdOpruimen: '' });
  }

  async verwijderAfsprakenVanAanvraag(aanvraagId: number): Promise<void> {
    for (const demo of await this.repo.demos(aanvraagId)) await this.verwijderAfsprakenVanDemo(demo);
  }

  /** Demo verwijderen inclusief afspraken en inzet (FR-58). */
  async verwijderDemo(demo: Demo): Promise<void> {
    for (const soort of AFSPRAAKSOORTEN) await this.graph.verwijderAfspraak(demo[EVENT_VELD[soort]]);
    for (const i of await this.repo.inzetVoorDemos([demo.id])) await this.repo.verwijderInzet(i.id);
    await this.repo.verwijderDemo(demo.id);
  }

  // ---- Begeleiders ----

  async voegBegeleiderToe(demoId: number, begeleiderId: number, duurMinuten?: number): Promise<SyncResultaat> {
    const bestaand = await this.repo.inzetVoorDemos([demoId]);
    if (bestaand.some(i => i.begeleiderId === begeleiderId)) throw new Error('Deze begeleider is al toegewezen aan deze demo.');
    await this.repo.maakInzet({ demoId, begeleiderId, duurMinuten });
    return this.synchroniseerDemo(demoId);
  }

  async verwijderBegeleider(demoId: number, inzetId: number): Promise<SyncResultaat> {
    await this.repo.verwijderInzet(inzetId);
    return this.synchroniseerDemo(demoId);
  }

  // ---- E-mail ----

  /** Verstuurt een antwoord of nieuwe mail vanuit de gedeelde mailbox en legt het vast (FR-32 t/m FR-36). */
  async verstuur(
    aanvraag: Aanvraag,
    opInkomend: Bericht | undefined,
    v: { aan: string; cc: string; onderwerp: string; tekstHtml: string; handtekening: string }
  ): Promise<void> {
    const aan = parseAdressen(v.aan);
    const cc = parseAdressen(v.cc);
    if (aan.length === 0) throw new Error('Vul minimaal één ontvanger in.');
    const html = antwoordHtml(v.tekstHtml, v.handtekening);
    const verzonden = opInkomend
      ? await this.graph.beantwoord(opInkomend.internetMessageId, html, aan, cc)
      : await this.graph.nieuweMail(v.onderwerp, html, aan, cc);

    await this.repo.maakBericht({
      aanvraagId: aanvraag.id,
      onderwerp: v.onderwerp,
      richting: 'Uitgaand',
      vanNaam: this.graph.mailboxAdres,
      vanAdres: this.graph.mailboxAdres,
      aan: aan.join('; '),
      cc: cc.join('; '),
      ontvangenOp: new Date(),
      body: html,
      conversationId: verzonden.conversationId,
      internetMessageId: verzonden.internetMessageId,
      graphMessageId: '',
      outlookLink: '',
      heeftBijlagen: false,
      verstuurdDoor: this.gebruikersnaam
    });
    await this.repo.wijzigAanvraag(aanvraag.id, { onbeantwoord: false });
  }

  /** Haalt naam van de afzender en de Outlook-link op via Graph en slaat die op bij het bericht. */
  async verrijkBericht(bericht: Bericht): Promise<Partial<Bericht> | undefined> {
    const g = await this.graph.zoekBericht(bericht.internetMessageId);
    if (!g) return undefined;
    const vanNaam = (g.from && g.from.emailAddress.name) || bericht.vanNaam;
    const outlookLink = g.webLink || '';
    await this.repo.wijzigBericht(bericht.id, { vanNaam, outlookLink, graphMessageId: g.id });
    return { vanNaam, outlookLink, graphMessageId: g.id };
  }

  /** Verplaatst een bericht naar een andere of nieuwe aanvraag (UC-13). Geeft het id van de doelaanvraag. */
  async verplaatsBericht(bericht: Bericht, naarAanvraagId: number | 'nieuw'): Promise<number> {
    let doel: number;
    if (naarAanvraagId === 'nieuw') {
      doel = await this.repo.maakAanvraag({
        titel: bericht.vanNaam || bericht.vanAdres,
        naam: bericht.vanNaam || bericht.vanAdres,
        email: bericht.vanAdres,
        status: 'Nieuw',
        onbeantwoord: true,
        bron: 'E-mail',
        laatsteBerichtOp: bericht.ontvangenOp
      });
    } else {
      doel = naarAanvraagId;
    }
    const van = bericht.aanvraagId;
    await this.repo.wijzigBericht(bericht.id, { aanvraagId: doel });
    await this.herberekenLaatsteBericht(van);
    await this.herberekenLaatsteBericht(doel);
    return doel;
  }

  private async herberekenLaatsteBericht(aanvraagId: number): Promise<void> {
    const inkomend = (await this.repo.berichten(aanvraagId)).filter(b => b.richting === 'Inkomend' && b.ontvangenOp);
    const laatste = inkomend.reduce<Date | undefined>((max, b) => (!max || (b.ontvangenOp as Date) > max ? b.ontvangenOp : max), undefined);
    await this.repo.wijzigAanvraag(aanvraagId, { laatsteBerichtOp: laatste });
  }

  // ---- Samenvoegen ----

  /**
   * Voegt `bron` samen met de aanvraag `doelId` (FR-44): berichten, demo's (met inzet en afspraken), notities en
   * geschiedenis gaan naar het doel, daarna gaat de bron naar de prullenbak. Eerst verplaatsen en pas als laatste
   * verwijderen, zodat een onderbroken samenvoeging opnieuw gestart kan worden zonder iets kwijt te raken.
   */
  async voegSamen(bron: Aanvraag, doelId: number, voortgang?: (m: string) => void): Promise<void> {
    if (bron.id === doelId) throw new Error('Een aanvraag kan niet met zichzelf worden samengevoegd.');
    const melding = voortgang || ((): void => undefined);
    const doel = await this.repo.aanvraag(doelId);
    if (doel.status === 'Verwijderd') throw new Error('Samenvoegen met een verwijderde aanvraag kan niet.');
    const { wijziging, notitie } = samenvoeging(doel, bron);

    melding('Berichten en demo’s verplaatsen…');
    await this.repo.verplaatsNaarAanvraag('berichten', bron.id, doelId);
    await this.repo.verplaatsNaarAanvraag('demos', bron.id, doelId);
    melding('Notities en geschiedenis verplaatsen…');
    await this.repo.verplaatsNaarAanvraag('notities', bron.id, doelId);
    await this.repo.verplaatsNaarAanvraag('statuswijzigingen', bron.id, doelId);

    melding('Gegevens bijwerken…');
    if (Object.keys(wijziging).length) await this.repo.wijzigAanvraag(doelId, wijziging, doel.etag);
    await this.repo.maakNotitie(doelId, notitie);
    await this.repo.verwijderAanvraag(bron.id);
  }

  // ---- Definitief verwijderen ----

  /** Verwijdert een aanvraag met alles wat erbij hoort (FR-43). Items gaan naar de prullenbak van de site. */
  async verwijderDefinitief(aanvraag: Aanvraag, voortgang?: (m: string) => void): Promise<void> {
    const melding = voortgang || ((): void => undefined);
    melding('Demo’s en agenda-afspraken verwijderen…');
    for (const demo of await this.repo.demos(aanvraag.id)) await this.verwijderDemo(demo);
    melding('Berichten, notities en geschiedenis verwijderen…');
    await this.repo.verwijderVanAanvraag('berichten', aanvraag.id);
    await this.repo.verwijderVanAanvraag('notities', aanvraag.id);
    await this.repo.verwijderVanAanvraag('statuswijzigingen', aanvraag.id);
    await this.repo.verwijderAanvraag(aanvraag.id);
  }
}
