// Excel-bestanden (FR-75, FR-78). ExcelJS is groot en wordt alleen geladen als er een export gemaakt wordt.

import type { Workbook, Worksheet } from 'exceljs';
import { datumNumeriek, tijd } from '../logic/datum';
import { DemoRij, demosPerType, eindTijd, matrix, urenPerBegeleider } from '../logic/rapportage';
import { Aanvraag, Begeleider } from '../model';

async function nieuweWerkmap(): Promise<Workbook> {
  const excel = await import(/* webpackChunkName: 'exceljs' */ 'exceljs');
  const Werkmap = (excel as unknown as { Workbook: new () => Workbook; default?: { Workbook: new () => Workbook } });
  const wb = new (Werkmap.Workbook || (Werkmap.default as { Workbook: new () => Workbook }).Workbook)();
  wb.creator = 'Halplanning';
  wb.created = new Date();
  return wb;
}

function blad(wb: Workbook, naam: string, kolommen: { kop: string; breedte?: number }[], rijen: unknown[][]): Worksheet {
  const ws = wb.addWorksheet(naam, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = kolommen.map(k => ({ header: k.kop, width: k.breedte || 16 }));
  ws.getRow(1).font = { bold: true };
  rijen.forEach(r => ws.addRow(r));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: kolommen.length } };
  return ws;
}

const uren = (minuten: number): number => Math.round((minuten / 60) * 100) / 100;

function demoKolommen(): { kop: string; breedte?: number }[] {
  return [
    { kop: 'Datum', breedte: 12 },
    { kop: 'Begin', breedte: 8 },
    { kop: 'Eind', breedte: 8 },
    { kop: 'Duur (min)', breedte: 10 },
    { kop: 'Titel', breedte: 30 },
    { kop: 'Type demo', breedte: 22 },
    { kop: 'Deelnemers', breedte: 11 },
    { kop: 'Begeleiders nodig', breedte: 10 },
    { kop: 'Begeleiders toegewezen', breedte: 10 },
    { kop: 'Begeleiders', breedte: 30 },
    { kop: 'Borrel', breedte: 22 },
    { kop: 'Wedstrijd', breedte: 10 },
    { kop: 'Planningsstatus', breedte: 12 },
    { kop: 'Prijsafspraak', breedte: 30 },
    { kop: 'Notitie', breedte: 30 }
  ];
}

function demoWaarden(r: DemoRij): unknown[] {
  const d = r.demo;
  return [
    datumNumeriek(d.start),
    tijd(d.start),
    tijd(eindTijd(r)),
    d.duurMinuten,
    d.titel,
    r.typeNaam,
    d.aantalDeelnemers ?? '',
    d.begeleidersNodig,
    r.toegewezen,
    r.begeleiders.map(b => b.begeleider.naam + (b.duurMinuten !== d.duurMinuten ? ' (' + b.duurMinuten + ' min)' : '')).join(', '),
    d.borrel,
    d.wedstrijd,
    d.planningsstatus,
    d.prijsafspraak,
    d.notitie
  ];
}

function klantKolommen(): { kop: string; breedte?: number }[] {
  return [
    { kop: 'Aanvraag', breedte: 30 },
    { kop: 'Naam', breedte: 22 },
    { kop: 'Organisatie', breedte: 22 },
    { kop: 'E-mailadres', breedte: 28 },
    { kop: 'Telefoon', breedte: 14 },
    { kop: 'IBAN', breedte: 24 },
    { kop: 'Status', breedte: 18 }
  ];
}

function klantWaarden(a?: Aanvraag): unknown[] {
  return a ? [a.titel, a.naam, a.organisatie, a.email, a.telefoon, a.iban, a.status] : ['', '', '', '', '', '', ''];
}

async function naarBlob(wb: Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Excel-export over een periode (FR-75). */
export async function excelExport(rijen: DemoRij[], begeleiders: Begeleider[]): Promise<Blob> {
  const wb = await nieuweWerkmap();

  blad(wb, "Demo's", klantKolommen().concat(demoKolommen()), rijen.map(r => klantWaarden(r.aanvraag).concat(demoWaarden(r))));

  blad(
    wb,
    'Begeleiders',
    [{ kop: 'Naam', breedte: 24 }, { kop: 'Telefoon', breedte: 14 }, { kop: 'E-mailadres', breedte: 28 }, { kop: 'Actief', breedte: 8 }],
    begeleiders.map(b => [b.naam, b.telefoon, b.email, b.actief ? 'ja' : 'nee'])
  );

  const m = matrix(rijen, begeleiders);
  blad(
    wb,
    'Demo x begeleider',
    [{ kop: 'Datum', breedte: 12 }, { kop: 'Begin', breedte: 8 }, { kop: 'Titel', breedte: 30 }].concat(m.kolommen.map(b => ({ kop: b.naam, breedte: 12 }))),
    rijen.map((r, i) => ([datumNumeriek(r.demo.start), tijd(r.demo.start), r.demo.titel] as unknown[]).concat(m.cellen[i].map(c => (c === undefined ? '' : uren(c)))))
  ).getCell(1, 1).note = 'Cellen bevatten het aantal ingezette uren.';

  blad(
    wb,
    'Uren per begeleider',
    [{ kop: 'Begeleider', breedte: 24 }, { kop: "Aantal demo's", breedte: 14 }, { kop: 'Uren', breedte: 10 }],
    urenPerBegeleider(rijen).map(u => [u.begeleider.naam, u.aantalDemos, uren(u.minuten)])
  );

  blad(
    wb,
    "Demo's per type",
    [{ kop: 'Type demo', breedte: 24 }, { kop: "Aantal demo's", breedte: 14 }, { kop: 'Deelnemers', breedte: 12 }],
    demosPerType(rijen).map(t => [t.typeNaam, t.aantalDemos, t.deelnemers])
  );

  return naarBlob(wb);
}

/** Factuurlijst: één rij per demo van aanvragen die klaar zijn voor facturatie (FR-78). */
export async function factuurlijst(rijen: DemoRij[], aanvragenZonderDemo: Aanvraag[]): Promise<Blob> {
  const wb = await nieuweWerkmap();
  const waarden = rijen
    .map(r => klantWaarden(r.aanvraag).concat(demoWaarden(r)))
    .concat(aanvragenZonderDemo.map(a => klantWaarden(a).concat(demoKolommen().map(() => ''))));
  blad(wb, 'Factuurlijst', klantKolommen().concat(demoKolommen()), waarden);
  return naarBlob(wb);
}
