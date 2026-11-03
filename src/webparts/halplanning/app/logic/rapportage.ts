// Gegevens voor de rapportages (FR-75 t/m FR-78). Alleen rekenwerk; de opmaak gebeurt elders.

import { Aanvraag, Begeleider, Demo, DemoType, eindVan, Inzet } from '../model';

export interface RapportBron {
  demos: Demo[];
  aanvragen: Aanvraag[];
  inzet: Inzet[];
  begeleiders: Begeleider[];
  demoTypes: DemoType[];
}

export interface DemoRij {
  demo: Demo;
  aanvraag?: Aanvraag;
  typeNaam: string;
  begeleiders: { begeleider: Begeleider; duurMinuten: number }[];
  toegewezen: number;
  compleet: boolean;
}

function indexOp<T extends { id: number }>(lijst: T[]): Record<number, T> {
  const uit: Record<number, T> = {};
  lijst.forEach(x => (uit[x.id] = x));
  return uit;
}

/** Combineert demo's met aanvraag, type en begeleiders. Demo's van verwijderde aanvragen vallen weg. */
export function demoRijen(bron: RapportBron): DemoRij[] {
  const aanvragen = indexOp(bron.aanvragen);
  const types = indexOp(bron.demoTypes);
  const begeleiders = indexOp(bron.begeleiders);
  return bron.demos
    .filter(d => {
      const a = aanvragen[d.aanvraagId];
      return !a || a.status !== 'Verwijderd';
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(demo => {
      const inzet = bron.inzet.filter(i => i.demoId === demo.id && begeleiders[i.begeleiderId]);
      const rij: DemoRij = {
        demo,
        aanvraag: aanvragen[demo.aanvraagId],
        typeNaam: demo.demoTypeId && types[demo.demoTypeId] ? types[demo.demoTypeId].naam : 'Onbekend',
        begeleiders: inzet.map(i => ({
          begeleider: begeleiders[i.begeleiderId],
          duurMinuten: i.duurMinuten || demo.duurMinuten
        })),
        toegewezen: inzet.length,
        compleet: inzet.length >= demo.begeleidersNodig
      };
      return rij;
    });
}

/** Korte markering voor achter de titel als er een borrel gewenst is (FR-76); leeg bij "geen" of "onbekend". */
export function borrelLabel(borrel: string): string {
  switch (borrel) {
    case 'vooraf':
    case 'achteraf':
      return 'borrel ' + borrel;
    case 'beide':
      return 'borrel vooraf en achteraf';
    case 'geen':
    case 'onbekend':
    case '':
      return '';
    default:
      return borrel;
  }
}

/** Namen van de ingezette begeleiders, alfabetisch. */
export function begeleiderNamen(rij: DemoRij): string {
  return rij.begeleiders
    .map(b => b.begeleider.naam)
    .sort((a, b) => a.localeCompare(b, 'nl'))
    .join(', ');
}

/** Demo's in [van, tot) die nog onvoldoende begeleiders hebben (FR-76). */
export function hulpGezocht(rijen: DemoRij[], van: Date, tot: Date): DemoRij[] {
  return komendeDemos(rijen, van, tot).filter(r => !r.compleet);
}

/** Alle demo's in [van, tot) (FR-77). */
export function komendeDemos(rijen: DemoRij[], van: Date, tot: Date): DemoRij[] {
  return rijen.filter(r => r.demo.start >= van && r.demo.start < tot);
}

export interface UrenPerBegeleider {
  begeleider: Begeleider;
  aantalDemos: number;
  minuten: number;
}

export function urenPerBegeleider(rijen: DemoRij[]): UrenPerBegeleider[] {
  const per: Record<number, UrenPerBegeleider> = {};
  for (const r of rijen) {
    for (const b of r.begeleiders) {
      const k = b.begeleider.id;
      if (!per[k]) per[k] = { begeleider: b.begeleider, aantalDemos: 0, minuten: 0 };
      per[k].aantalDemos++;
      per[k].minuten += b.duurMinuten;
    }
  }
  return Object.keys(per)
    .map(k => per[+k])
    .sort((a, b) => a.begeleider.naam.localeCompare(b.begeleider.naam, 'nl'));
}

export interface PerType {
  typeNaam: string;
  aantalDemos: number;
  deelnemers: number;
}

export function demosPerType(rijen: DemoRij[]): PerType[] {
  const per: Record<string, PerType> = {};
  for (const r of rijen) {
    if (!per[r.typeNaam]) per[r.typeNaam] = { typeNaam: r.typeNaam, aantalDemos: 0, deelnemers: 0 };
    per[r.typeNaam].aantalDemos++;
    per[r.typeNaam].deelnemers += r.demo.aantalDeelnemers || 0;
  }
  return Object.keys(per)
    .map(k => per[k])
    .sort((a, b) => a.typeNaam.localeCompare(b.typeNaam, 'nl'));
}

/** Matrix demo × begeleider: per demo de minuten per begeleider (leeg = niet ingezet). */
export function matrix(rijen: DemoRij[], begeleiders: Begeleider[]): { kolommen: Begeleider[]; cellen: (number | undefined)[][] } {
  const kolommen = begeleiders
    .filter(b => rijen.some(r => r.begeleiders.some(x => x.begeleider.id === b.id)))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  const cellen = rijen.map(r =>
    kolommen.map(b => {
      const x = r.begeleiders.filter(y => y.begeleider.id === b.id)[0];
      return x ? x.duurMinuten : undefined;
    })
  );
  return { kolommen, cellen };
}

export function eindTijd(r: DemoRij): Date {
  return eindVan(r.demo);
}
