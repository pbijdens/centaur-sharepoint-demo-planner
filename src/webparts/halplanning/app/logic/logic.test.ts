import { afsprakenVoorDemo, HELP_GEZOCHT, locatieTekst, plaatsItems, AgendaItem } from './agenda';
import { naarGraphDatumTijd, vanGraphDatumTijd, vanInvoer, duurTekst } from './datum';
import { allenBeantwoorden, parseAdressen, splitsCitaat, voegInNaBody, antwoordOnderwerp, naarTekst, antwoordHtml } from './mail';
import { formatteerIban, isGeldigeIban, isGeldigEmail } from './validatie';
import { demoRijen, hulpGezocht, komendeDemos, urenPerBegeleider, demosPerType, matrix, RapportBron, borrelLabel, begeleiderNamen } from './rapportage';
import { demoOverzichtPerAanvraag, LijstDemo, samenvoeging, sorteerAanvragen } from './aanvragen';
import { Aanvraag, Begeleider, Demo } from '../model';

describe('validatie', () => {
  it('herkent geldige en ongeldige IBANs', () => {
    expect(isGeldigeIban('NL91 ABNA 0417 1643 00')).toBe(true);
    expect(isGeldigeIban('nl91abna0417164300')).toBe(true);
    expect(isGeldigeIban('NL91 ABNA 0417 1643 01')).toBe(false);
    expect(isGeldigeIban('GB82 WEST 1234 5698 7654 32')).toBe(true);
    expect(isGeldigeIban('')).toBe(false);
    expect(isGeldigeIban('NL91')).toBe(false);
  });

  it('formatteert IBAN per 4 tekens', () => {
    expect(formatteerIban('nl91abna0417164300')).toBe('NL91 ABNA 0417 1643 00');
  });

  it('controleert e-mailadressen', () => {
    expect(isGeldigEmail('jan@voorbeeld.nl')).toBe(true);
    expect(isGeldigEmail('jan@voorbeeld')).toBe(false);
    expect(isGeldigEmail('jan voorbeeld.nl')).toBe(false);
  });
});

describe('datum', () => {
  it('zet een lokale datum om naar het Graph-formaat en terug', () => {
    const d = new Date(2026, 10, 2, 9, 5);
    expect(naarGraphDatumTijd(d)).toBe('2026-11-02T09:05:00');
    expect(vanGraphDatumTijd('2026-11-02T09:05:00.0000000').getTime()).toBe(d.getTime());
  });

  it('leest invoervelden', () => {
    expect(vanInvoer('2026-11-02', '14:30')).toEqual(new Date(2026, 10, 2, 14, 30));
    expect(vanInvoer('', '14:30')).toBeUndefined();
  });

  it('beschrijft een duur', () => {
    expect(duurTekst(45)).toBe('45 min');
    expect(duurTekst(60)).toBe('1 uur');
    expect(duurTekst(90)).toBe('1:30 uur');
  });
});

describe('mail', () => {
  it('zet een witregel tussen tekst en handtekening', () => {
    expect(antwoordHtml('<p>Hoi</p>', '<p>Groet</p>')).toBe('<div><p>Hoi</p><div><br></div><div class="halplanning-handtekening"><p>Groet</p></div></div>');
    expect(antwoordHtml('<p>Hoi</p>', '')).toBe('<div><p>Hoi</p></div>');
  });

  it('haalt adressen uit een tekst', () => {
    expect(parseAdressen('a@x.nl; Jan <B@y.nl>, a@x.nl')).toEqual(['a@x.nl', 'B@y.nl']);
    expect(parseAdressen('')).toEqual([]);
  });

  it('berekent ontvangers voor allen beantwoorden zonder de gedeelde mailbox', () => {
    const r = allenBeantwoorden(
      { vanAdres: 'klant@x.nl', aan: 'halplanning@centaur.nl; collega@x.nl', cc: 'baas@x.nl; HALPLANNING@centaur.nl; klant@x.nl' },
      'halplanning@centaur.nl'
    );
    expect(r.aan).toEqual(['klant@x.nl', 'collega@x.nl']);
    expect(r.cc).toEqual(['baas@x.nl']);
  });

  it('splitst geciteerde tekst af bij Outlook-markeringen', () => {
    const html = '<p>Graag op 12 juni.</p><div id="appendonsend"></div><hr><div id="divRplyFwdMsg">Van: ...</div>';
    const r = splitsCitaat(html);
    expect(r.hoofd).toBe('<p>Graag op 12 juni.</p>');
    expect(r.citaat).toContain('appendonsend');
  });

  it('splitst geciteerde tekst af bij Gmail-markeringen', () => {
    const r = splitsCitaat('<div>Ja prima</div><div class="gmail_quote">Op ma schreef...</div>');
    expect(r.hoofd).toBe('<div>Ja prima</div>');
  });

  it('splitst niet als er alleen citaat is', () => {
    const html = '<div class="gmail_quote">alles</div>';
    expect(splitsCitaat(html)).toEqual({ hoofd: html, citaat: '' });
  });

  it('voegt tekst in na de body-tag', () => {
    expect(voegInNaBody('<html><body dir="ltr"><p>oud</p></body></html>', '<p>nieuw</p>')).toBe(
      '<html><body dir="ltr"><p>nieuw</p><p>oud</p></body></html>'
    );
    expect(voegInNaBody('<p>oud</p>', '<p>nieuw</p>')).toBe('<p>nieuw</p><p>oud</p>');
  });

  it('maakt een antwoordonderwerp', () => {
    expect(antwoordOnderwerp('Demo aanvraag')).toBe('Re: Demo aanvraag');
    expect(antwoordOnderwerp('RE: Demo aanvraag')).toBe('RE: Demo aanvraag');
    expect(antwoordOnderwerp('Antw: Demo')).toBe('Antw: Demo');
  });

  it('zet HTML om naar tekst', () => {
    expect(naarTekst('<p>Hallo&nbsp;daar</p><style>p{}</style><p>regel 2</p>')).toBe('Hallo daar\nregel 2');
  });
});

describe('agenda', () => {
  const basis = {
    titel: 'Feest Jansen',
    start: new Date(2026, 5, 12, 14, 0),
    duurMinuten: 60,
    aantalDeelnemers: 20,
    borrel: 'achteraf' as const,
    begeleidersNodig: 2
  };

  it('maakt drie voorlopige afspraken met de juiste tijden', () => {
    const a = afsprakenVoorDemo({ demo: { ...basis, planningsstatus: 'Voorlopig' }, demoTypeNaam: 'Bedrijfsdemo', begeleiderNamen: ['Piet'] });
    expect(a.opbouwen.start.dateTime).toBe('2026-06-12T13:30:00');
    expect(a.opbouwen.end.dateTime).toBe('2026-06-12T14:00:00');
    expect(a.demo.start.dateTime).toBe('2026-06-12T14:00:00');
    expect(a.demo.end.dateTime).toBe('2026-06-12T15:00:00');
    expect(a.opruimen.start.dateTime).toBe('2026-06-12T15:00:00');
    expect(a.opruimen.end.dateTime).toBe('2026-06-12T15:30:00');
    expect(a.demo.showAs).toBe('tentative');
    expect(a.demo.categories).toEqual(['Gereserveerd']);
    expect(a.opbouwen.categories).toEqual(['Gereserveerd']);
    expect(a.demo.subject).toBe('Feest Jansen');
    expect(a.opbouwen.subject).toBe('Opbouwen demo – Feest Jansen');
    expect(a.demo.location.displayName).toBe('Piet, ' + HELP_GEZOCHT);
    expect(a.demo.body.content).toContain('Bedrijfsdemo');
    expect(a.demo.body.content).toContain('20');
    expect(a.demo.body.content).toContain('achteraf');
  });

  it('gebruikt bij definitief de categorieën Demo en Gereserveerd (bevestigd)', () => {
    const a = afsprakenVoorDemo({ demo: { ...basis, planningsstatus: 'Definitief' }, demoTypeNaam: 'X', begeleiderNamen: ['A', 'B'] });
    expect(a.demo.showAs).toBe('busy');
    expect(a.demo.categories).toEqual(['Demo']);
    expect(a.opbouwen.categories).toEqual(['Gereserveerd (bevestigd)']);
    expect(a.opruimen.categories).toEqual(['Gereserveerd (bevestigd)']);
    expect(a.demo.location.displayName).toBe('A, B');
  });

  it('meldt help gezocht zonder begeleiders', () => {
    expect(locatieTekst([], 2)).toBe(HELP_GEZOCHT);
    expect(locatieTekst(['A', 'B', 'C'], 2)).toBe('A, B, C');
  });

  it('plaatst overlappende afspraken in kolommen', () => {
    const dag = new Date(2026, 5, 12);
    const item = (id: string, vanU: number, totU: number): AgendaItem => ({
      id,
      onderwerp: id,
      start: new Date(2026, 5, 12, vanU),
      eind: new Date(2026, 5, 12, totU),
      heleDag: false,
      showAs: 'busy',
      categorieen: [],
      locatie: ''
    });
    const p = plaatsItems([item('a', 9, 11), item('b', 10, 12), item('c', 13, 14), { ...item('d', 0, 0), heleDag: true }], dag);
    const per = (id: string): { kolom: number; kolommen: number } => p.filter(x => x.item.id === id)[0];
    expect(p.length).toBe(3);
    expect(per('a')).toMatchObject({ kolom: 0, kolommen: 2 });
    expect(per('b')).toMatchObject({ kolom: 1, kolommen: 2 });
    expect(per('c')).toMatchObject({ kolom: 0, kolommen: 1 });
  });
});

describe('rapportage', () => {
  const aanvraag = (id: number, status: Aanvraag['status']): Aanvraag => ({
    id, titel: 'A' + id, naam: '', organisatie: '', email: '', telefoon: '', iban: '', status, onbeantwoord: false, bron: 'E-mail'
  });
  const demo = (id: number, aanvraagId: number, dag: number, nodig: number, typeId?: number): Demo => ({
    id, aanvraagId, titel: 'D' + id, start: new Date(2026, 5, dag, 14), duurMinuten: 60, demoTypeId: typeId,
    aantalDeelnemers: 10, begeleidersNodig: nodig, borrel: 'geen', wedstrijd: 'nee', prijsafspraak: '', notitie: '',
    planningsstatus: 'Definitief', eventIdDemo: '', eventIdOpbouwen: '', eventIdOpruimen: ''
  });
  const begeleider = (id: number, naam: string): Begeleider => ({ id, naam, telefoon: '', email: '', actief: true });

  const bron: RapportBron = {
    aanvragen: [aanvraag(1, 'Bevestigd'), aanvraag(2, 'Verwijderd')],
    demos: [demo(10, 1, 5, 2, 1), demo(11, 1, 3, 1), demo(12, 2, 4, 2)],
    begeleiders: [begeleider(100, 'Piet'), begeleider(101, 'Anna')],
    inzet: [
      { id: 1, demoId: 10, begeleiderId: 100 },
      { id: 2, demoId: 11, begeleiderId: 100, duurMinuten: 30 },
      { id: 3, demoId: 11, begeleiderId: 101 }
    ],
    demoTypes: [{ id: 1, naam: 'Schoolklas', volgorde: 1, actief: true }]
  };

  it('laat demo’s van verwijderde aanvragen weg en sorteert op datum', () => {
    const rijen = demoRijen(bron);
    expect(rijen.map(r => r.demo.id)).toEqual([11, 10]);
    expect(rijen[1].typeNaam).toBe('Schoolklas');
    expect(rijen[0].typeNaam).toBe('Onbekend');
  });

  it('bepaalt welke demo’s hulp nodig hebben', () => {
    const rijen = demoRijen(bron);
    const van = new Date(2026, 5, 1);
    const tot = new Date(2026, 5, 29);
    expect(hulpGezocht(rijen, van, tot).map(r => r.demo.id)).toEqual([10]);
    expect(komendeDemos(rijen, van, tot).length).toBe(2);
    expect(komendeDemos(rijen, new Date(2026, 5, 4), tot).map(r => r.demo.id)).toEqual([10]);
  });

  it('telt uren per begeleider en demo’s per type', () => {
    const rijen = demoRijen(bron);
    const uren = urenPerBegeleider(rijen);
    expect(uren.map(u => [u.begeleider.naam, u.aantalDemos, u.minuten])).toEqual([['Anna', 1, 60], ['Piet', 2, 90]]);
    expect(demosPerType(rijen)).toEqual([
      { typeNaam: 'Onbekend', aantalDemos: 1, deelnemers: 10 },
      { typeNaam: 'Schoolklas', aantalDemos: 1, deelnemers: 10 }
    ]);
    const m = matrix(rijen, bron.begeleiders);
    expect(m.kolommen.map(k => k.naam)).toEqual(['Anna', 'Piet']);
    expect(m.cellen).toEqual([[60, 30], [undefined, 60]]);
  });

  it('toont begeleiders en een gewenste borrel', () => {
    const rijen = demoRijen(bron);
    expect(begeleiderNamen(rijen[0])).toBe('Anna, Piet');
    expect(begeleiderNamen(rijen[1])).toBe('Piet');
    expect(borrelLabel('geen')).toBe('');
    expect(borrelLabel('onbekend')).toBe('');
    expect(borrelLabel('vooraf')).toBe('borrel vooraf');
    expect(borrelLabel('beide')).toBe('borrel vooraf en achteraf');
    expect(borrelLabel('patat met snack achteraf')).toBe('patat met snack achteraf');
  });
});

describe('aanvragen', () => {
  const aanvraag = (id: number, status: Aanvraag['status'], bericht?: Date, extra: Partial<Aanvraag> = {}): Aanvraag => ({
    id, titel: 'A' + id, naam: '', organisatie: '', email: '', telefoon: '', iban: '', status, onbeantwoord: false, bron: 'E-mail',
    laatsteBerichtOp: bericht, ...extra
  });
  const lijst = [
    aanvraag(1, 'Bevestigd', new Date(2026, 0, 3)),
    aanvraag(2, 'Nieuw', new Date(2026, 0, 1)),
    aanvraag(3, 'Nieuw', new Date(2026, 0, 2)),
    aanvraag(4, 'In afwachting')
  ];
  const nu = new Date(2026, 5, 4, 12, 0);
  const demo = (id: number, aanvraagId: number, start: Date, extra: Partial<LijstDemo> = {}): LijstDemo => ({
    id, aanvraagId, start, duurMinuten: 60, begeleidersNodig: 2, eventIdDemo: 'e' + id, ...extra
  });
  const overzicht = demoOverzichtPerAanvraag(
    [
      demo(1, 1, new Date(2026, 5, 9)),
      demo(2, 1, new Date(2026, 5, 2)),
      demo(3, 1, new Date(2026, 5, 6), { eventIdDemo: '', begeleidersNodig: 0 }),
      demo(4, 3, new Date(2026, 5, 5), { begeleidersNodig: 3 }),
      demo(5, 2, new Date(2026, 4, 1, 9), { eventIdDemo: '', begeleidersNodig: 5 }),
      demo(6, 2, new Date(2026, 5, 4, 11, 30))
    ],
    [1, 1, 2, 2, 3, 3, 4, 4, 6, 6].map(demoId => ({ demoId })),
    nu
  );

  it('vat de demo’s per aanvraag samen', () => {
    expect(overzicht[1]).toEqual({ aantal: 3, volgende: new Date(2026, 5, 6), laatste: new Date(2026, 5, 9), nietInAgenda: 1, tekortBegeleiders: 0 });
    expect(overzicht[3]).toEqual({ aantal: 1, volgende: new Date(2026, 5, 5), laatste: new Date(2026, 5, 5), nietInAgenda: 0, tekortBegeleiders: 1 });
    // Demo 6 loopt nog (tot 12:30) en telt als volgende; de voorbije demo 5 telt niet mee voor de waarschuwingen.
    expect(overzicht[2]).toEqual({ aantal: 2, volgende: new Date(2026, 5, 4, 11, 30), laatste: new Date(2026, 5, 4, 11, 30), nietInAgenda: 0, tekortBegeleiders: 0 });
    expect(overzicht[4]).toBeUndefined();
  });

  it('sorteert op laatste bericht, eerstvolgende demo en status', () => {
    const alleenVoorbij = demoOverzichtPerAanvraag([demo(7, 2, new Date(2026, 4, 1))], [], nu);
    expect(sorteerAanvragen(lijst, 'bericht', overzicht).map(a => a.id)).toEqual([1, 3, 2, 4]);
    expect(sorteerAanvragen(lijst, 'demo', overzicht).map(a => a.id)).toEqual([2, 3, 1, 4]);
    expect(sorteerAanvragen(lijst, 'demo', alleenVoorbij).map(a => a.id)).toEqual([1, 3, 2, 4]);
    expect(sorteerAanvragen(lijst, 'status', overzicht).map(a => a.id)).toEqual([3, 2, 4, 1]);
    expect(lijst.map(a => a.id)).toEqual([1, 2, 3, 4]);
  });

  it('vult bij samenvoegen lege gegevens aan en noemt afwijkende', () => {
    const doel = aanvraag(1, 'Bevestigd', new Date(2026, 0, 1), { naam: 'Jan', email: 'jan@x.nl' });
    const bron = aanvraag(2, 'Nieuw', new Date(2026, 0, 5), { titel: 'Vraag', naam: 'Jan', email: 'j@y.nl', telefoon: '06 1234', onbeantwoord: true });
    const s = samenvoeging(doel, bron);
    expect(s.wijziging).toEqual({ telefoon: '06 1234', onbeantwoord: true, laatsteBerichtOp: new Date(2026, 0, 5) });
    expect(s.notitie).toContain('“Vraag”');
    expect(s.notitie).toContain('E-mailadres: j@y.nl');
    expect(s.notitie).not.toContain('Naam:');
  });
});
