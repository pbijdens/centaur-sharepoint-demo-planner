import { afsprakenVoorDemo, HELP_GEZOCHT, locatieTekst, plaatsItems, AgendaItem, opnieuwAanmaken, verschuiving } from './agenda';
import { naarGraphDatumTijd, vanGraphDatumTijd, vanInvoer, duurTekst } from './datum';
import { allenBeantwoorden, parseAdressen, splitsCitaat, voegInNaBody, antwoordOnderwerp, naarTekst, antwoordHtml, bodyInhoud, citaatHtml } from './mail';
import { alleenGewijzigd, conflictVelden, gelijkeWaarde } from './conflict';
import { bewaarGrens, FoutBegrenzer, foutDetails } from './foutlog';
import { formatteerIban, isGeldigeIban, isGeldigEmail } from './validatie';
import { demoRijen, hulpGezocht, komendeDemos, urenPerBegeleider, demosPerType, matrix, RapportBron, borrelLabel, begeleiderNamen } from './rapportage';
import { demoOverzichtPerAanvraag, LijstDemo, samenvoeging, sorteerAanvragen } from './aanvragen';
import { aantalPlekken, demosVoorIndeling, kleurIndex, opNaam, overlapVoor, perDag, toegewezenIds } from './indeling';
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

describe('conflict', () => {
  interface X { a?: string; b?: number; c?: Date; etag?: string }
  const t1 = new Date('2026-12-06T12:30:00Z');

  test('gelijkeWaarde: leeg en datums', () => {
    expect(gelijkeWaarde(undefined, '')).toBe(true);
    expect(gelijkeWaarde(null, 0)).toBe(false);
    expect(gelijkeWaarde(t1, new Date(t1.getTime()))).toBe(true);
    expect(gelijkeWaarde(t1, new Date(t1.getTime() + 1))).toBe(false);
  });

  test('alleenGewijzigd laat ongewijzigde velden weg', () => {
    const orig: X = { a: 'x', b: 1, c: t1 };
    expect(alleenGewijzigd<X>({ a: 'x', b: 2, c: new Date(t1.getTime()) }, orig)).toEqual({ b: 2 });
  });

  test('geen conflict als een ander alleen andere velden wijzigde (flow, synchronisatie)', () => {
    const orig: X = { a: 'x', b: 1, etag: '1' };
    const actueel: X = { a: 'x', b: 1, c: t1, etag: '2' };
    expect(conflictVelden<X>({ a: 'y' }, orig, actueel)).toEqual([]);
  });

  test('geen conflict als het veld al de gewenste waarde heeft (eerdere poging gelukt)', () => {
    expect(conflictVelden<X>({ a: 'y' }, { a: 'x' }, { a: 'y' })).toEqual([]);
  });

  test('conflict als een ander hetzelfde veld anders wijzigde', () => {
    expect(conflictVelden<X>({ a: 'y' }, { a: 'x' }, { a: 'z' })).toEqual(['a']);
  });
});

describe('citaat', () => {
  test('bodyInhoud haalt head en stijlen weg', () => {
    expect(bodyInhoud('<html><head><style>p{}</style></head><body class="x"><p>Hoi</p></body></html>')).toBe('<p>Hoi</p>');
    expect(bodyInhoud('<p>Los</p>')).toBe('<p>Los</p>');
  });

  test('citaatHtml bevat kop en oorspronkelijke tekst', () => {
    const h = citaatHtml({
      vanNaam: 'Jan <test>',
      vanAdres: 'jan@x.nl',
      aan: 'halplanning@x.nl',
      cc: '',
      onderwerp: 'Demo',
      ontvangenOp: new Date('2026-11-10T10:00:00Z'),
      body: '<html><body><p>Vraag</p></body></html>'
    });
    expect(h).toContain('Jan &lt;test&gt; &lt;jan@x.nl&gt;');
    expect(h).toContain('<b>Onderwerp:</b> Demo');
    expect(h).toContain('<p>Vraag</p>');
    expect(h).not.toContain('<b>CC:</b>');
  });
});

describe('verwijderde afspraken (FR-57)', () => {
  const t = new Date('2026-12-06T12:30:00Z');
  const later = new Date('2026-12-06T13:30:00Z');

  test('demo-afspraak komt altijd terug', () => {
    expect(opnieuwAanmaken('demo', false)).toBe(true);
  });

  test('opbouwen en opruimen niet zonder verschuiving of herstel', () => {
    const v = verschuiving({ start: t, duurMinuten: 60 }, { start: t, duurMinuten: 60 });
    expect(opnieuwAanmaken('opbouwen', false, v)).toBe(false);
    expect(opnieuwAanmaken('opruimen', false, v)).toBe(false);
    expect(opnieuwAanmaken('opruimen', true, v)).toBe(true);
  });

  test('verplaatsen brengt beide terug, alleen langer maken alleen opruimen', () => {
    const verplaatst = verschuiving({ start: t, duurMinuten: 60 }, { start: later, duurMinuten: 60 });
    expect(opnieuwAanmaken('opbouwen', false, verplaatst)).toBe(true);
    expect(opnieuwAanmaken('opruimen', false, verplaatst)).toBe(true);
    const langer = verschuiving({ start: t, duurMinuten: 60 }, { start: t, duurMinuten: 90 });
    expect(opnieuwAanmaken('opbouwen', false, langer)).toBe(false);
    expect(opnieuwAanmaken('opruimen', false, langer)).toBe(true);
  });
});

describe('foutlog', () => {
  test('bewaarGrens ligt 4 weken terug', () => {
    expect(bewaarGrens(new Date('2026-11-14T12:00:00Z')).toISOString()).toBe('2026-10-17T12:00:00.000Z');
  });

  test('foutDetails van een HTTP-fout (PnPjs)', () => {
    const e = Object.assign(new Error('Precondition failed'), { status: 412, response: { status: 412, url: 'https://x/_api/items(1)' } });
    const d = foutDetails(e);
    expect(d.status).toBe(412);
    expect(d.verzoek).toBe('https://x/_api/items(1)');
    expect(d.details).toContain('HTTP-status: 412');
    expect(d.details).toContain('Bericht: Precondition failed');
  });

  test('foutDetails van een Graph-fout en een tekst', () => {
    const d = foutDetails({ statusCode: 404, code: 'ErrorItemNotFound', requestId: 'abc', message: 'Not found', body: '{"x":1}' });
    expect(d.status).toBe(404);
    expect(d.details).toContain('Code: ErrorItemNotFound');
    expect(d.details).toContain('Request-id: abc');
    expect(d.details).toContain('Antwoord: {"x":1}');
    expect(foutDetails('Vul minimaal één ontvanger in.')).toEqual({ verzoek: '', details: 'Vul minimaal één ontvanger in.' });
  });

  test('FoutBegrenzer: geen herhaling binnen 10 s en hooguit 20 per minuut', () => {
    const b = new FoutBegrenzer();
    expect(b.mag('a', 0)).toBe(true);
    expect(b.mag('a', 5000)).toBe(false);
    expect(b.mag('a', 11000)).toBe(true);
    for (let i = 0; i < 18; i++) expect(b.mag('x' + i, 12000)).toBe(true);
    expect(b.mag('y', 12000)).toBe(false);
    expect(b.mag('y', 61000)).toBe(true);
  });
});

describe('begeleiders indelen (FR-63 t/m FR-65)', () => {
  const aanvraag = (id: number, status: Aanvraag['status']): Aanvraag => ({
    id, titel: 'A' + id, naam: '', organisatie: '', email: '', telefoon: '', iban: '', status, onbeantwoord: false, bron: 'E-mail'
  });
  const demo = (id: number, aanvraagId: number, start: Date, eventIdDemo: string = 'ev' + id, duurMinuten: number = 60): Demo => ({
    id, aanvraagId, titel: 'D' + id, start, duurMinuten, aantalDeelnemers: 10, begeleidersNodig: 2, borrel: 'geen',
    wedstrijd: 'nee', prijsafspraak: '', notitie: '', planningsstatus: 'Voorlopig', eventIdDemo, eventIdOpbouwen: '', eventIdOpruimen: ''
  });

  it('kiest demo’s in de agenda bij In afwachting en Bevestigd, vanaf een datum, op tijd gesorteerd', () => {
    const aanvragen = [aanvraag(1, 'In afwachting'), aanvraag(2, 'Bevestigd'), aanvraag(3, 'Nieuw'), aanvraag(4, 'Gesloten')];
    const demos = [
      demo(10, 2, new Date(2026, 10, 20, 14)),
      demo(11, 1, new Date(2026, 10, 18, 10)),
      demo(12, 1, new Date(2026, 10, 19, 10), ''),
      demo(13, 3, new Date(2026, 10, 19, 10)),
      demo(14, 4, new Date(2026, 10, 19, 10)),
      demo(15, 2, new Date(2026, 10, 10, 10))
    ];
    expect(demosVoorIndeling(demos, aanvragen, new Date(2026, 10, 15)).map(d => d.id)).toEqual([11, 10]);
    expect(demosVoorIndeling(demos, aanvragen).map(d => d.id)).toEqual([15, 11, 10]);
  });

  it('toont een demo van vandaag die nog bezig is', () => {
    const d = demo(1, 1, new Date(2026, 10, 15, 9), 'e', 120);
    expect(demosVoorIndeling([d], [aanvraag(1, 'Bevestigd')], new Date(2026, 10, 15, 10))).toHaveLength(1);
  });

  it('sorteert op naam, ongeacht hoofdletters en volgorde van invoer', () => {
    expect(opNaam([{ naam: 'piet' }, { naam: 'Anna' }, { naam: 'Émile' }, { naam: 'bert' }]).map(b => b.naam)).toEqual(['Anna', 'bert', 'Émile', 'piet']);
  });

  it('geeft elke begeleider een vaste kleur op volgorde van aanmaken', () => {
    expect(kleurIndex([{ id: 9 }, { id: 3 }, { id: 5 }], 20)).toEqual({ 3: 0, 5: 1, 9: 2 });
    expect(kleurIndex([{ id: 1 }, { id: 2 }, { id: 3 }], 2)).toEqual({ 1: 0, 2: 1, 3: 0 });
  });

  it('past wijzigingen die nog worden opgeslagen toe op de toewijzing', () => {
    const inzet = [{ id: 1, demoId: 10, begeleiderId: 100 }, { id: 2, demoId: 11, begeleiderId: 101 }];
    expect(toegewezenIds(10, inzet, [])).toEqual([100]);
    expect(
      toegewezenIds(10, inzet, [
        { soort: 'toevoegen', demoId: 10, begeleiderId: 102 },
        { soort: 'verwijderen', demoId: 10, begeleiderId: 100 },
        { soort: 'toevoegen', demoId: 11, begeleiderId: 103 }
      ])
    ).toEqual([102]);
    expect(
      toegewezenIds(10, inzet, [
        { soort: 'toevoegen', demoId: 10, begeleiderId: 102 },
        { soort: 'verwijderen', demoId: 10, begeleiderId: 102 }
      ])
    ).toEqual([100]);
  });

  it('toont minstens zoveel plekken als er begeleiders staan', () => {
    expect(aantalPlekken(2, 0)).toBe(2);
    expect(aantalPlekken(2, 3)).toBe(3);
    expect(aantalPlekken(0, 0)).toBe(0);
  });

  it('vindt overlappende demo’s van dezelfde begeleider, maar niet aansluitende', () => {
    const a = demo(1, 1, new Date(2026, 10, 20, 14));
    const b = demo(2, 1, new Date(2026, 10, 20, 14, 30));
    const c = demo(3, 1, new Date(2026, 10, 20, 15));
    const toegewezen = (id: number): number[] => (id === 2 || id === 3 ? [100] : []);
    expect(overlapVoor(a, 100, [a, b, c], toegewezen).map(d => d.id)).toEqual([2]);
    expect(overlapVoor(a, 101, [a, b, c], toegewezen)).toEqual([]);
  });

  it('groepeert per dag', () => {
    const groepen = perDag([
      { start: new Date(2026, 10, 20, 9) },
      { start: new Date(2026, 10, 20, 15) },
      { start: new Date(2026, 10, 21, 9) }
    ]);
    expect(groepen.map(g => g.items.length)).toEqual([2, 1]);
    expect(groepen[1].dag).toEqual(new Date(2026, 10, 21));
  });
});
