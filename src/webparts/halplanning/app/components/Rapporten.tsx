// Dialogen voor Excel-export, factuurlijst en de lijsten als afbeelding (FR-75 t/m FR-79).

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles
} from '@fluentui/react-components';
import { ArrowDownloadRegular, CopyRegular, ShareRegular } from '@fluentui/react-icons';
import { Diensten, useDiensten } from '../AppContext';
import { begin, datumKort, datumNumeriek, duurTekst, naarInvoerDatum, plusDagen, tijd, vanInvoer } from '../logic/datum';
import { begeleiderNamen, borrelLabel, DemoRij, demoRijen, hulpGezocht, komendeDemos } from '../logic/rapportage';
import { Begeleider } from '../model';
import { bestandsdatum, deel, download, kanDelen, kanKopieren, kopieer } from '../rapporten/bestanden';
import { Fout, Laden, useBezig, useGedeeldeStijl } from './algemeen';

/** Laadt demo's in [van, tot) met alles wat de rapportages nodig hebben. */
async function laadRijen(d: Diensten, van: Date, tot: Date): Promise<{ rijen: DemoRij[]; begeleiders: Begeleider[] }> {
  const demos = await d.repo.demosInPeriode(van, tot);
  const [aanvragen, inzet, begeleiders, demoTypes] = await Promise.all([
    d.repo.aanvragenOpIds(demos.map(x => x.aanvraagId)),
    d.repo.inzetVoorDemos(demos.map(x => x.id)),
    d.repo.begeleiders(),
    d.repo.demoTypes()
  ]);
  return { rijen: demoRijen({ demos, aanvragen, inzet, begeleiders, demoTypes }), begeleiders };
}

// ---- Excel-export (FR-75) ----

export function ExcelDialoog(props: { open: boolean; onSluit: () => void }): JSX.Element {
  const d = useDiensten();
  const nu = new Date();
  const [van, setVan] = React.useState(naarInvoerDatum(new Date(nu.getFullYear(), nu.getMonth(), 1)));
  const [tot, setTot] = React.useState(naarInvoerDatum(new Date(nu.getFullYear(), nu.getMonth() + 1, 0)));
  const [bezig, voerUit] = useBezig();

  const vanDatum = vanInvoer(van, '00:00');
  const totDatum = vanInvoer(tot, '00:00');
  const geldig = !!vanDatum && !!totDatum && totDatum >= vanDatum;

  const maak = async (): Promise<void> => {
    if (!vanDatum || !totDatum) return;
    const ok = await voerUit(async () => {
      const { rijen, begeleiders } = await laadRijen(d, vanDatum, plusDagen(totDatum, 1));
      const { excelExport } = await import(/* webpackChunkName: 'halplanning-excel' */ '../rapporten/excel');
      download(await excelExport(rijen, begeleiders), 'Halplanning ' + bestandsdatum(vanDatum) + ' tot en met ' + bestandsdatum(totDatum) + '.xlsx');
      return true;
    }, 'Excel-bestand gemaakt');
    if (ok) props.onSluit();
  };

  return (
    <Dialog open={props.open} onOpenChange={(_, v) => !v.open && props.onSluit()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Excel-export</DialogTitle>
          <DialogContent>
            <p>Alle demo’s in de periode, met tabbladen voor begeleiders, demo × begeleider, uren per begeleider en demo’s per type.</p>
            <Field label="Van">
              <Input type="date" value={van} onChange={(_, v) => setVan(v.value)} />
            </Field>
            <Field label="Tot en met" validationMessage={vanDatum && totDatum && totDatum < vanDatum ? 'De einddatum ligt vóór de begindatum.' : undefined}>
              <Input type="date" value={tot} onChange={(_, v) => setTot(v.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={props.onSluit} disabled={bezig}>
              Annuleren
            </Button>
            <Button appearance="primary" icon={<ArrowDownloadRegular />} disabled={!geldig || bezig} onClick={maak}>
              {bezig ? 'Bezig…' : 'Downloaden'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ---- Factuurlijst (FR-78) ----

export async function maakFactuurlijst(d: Diensten): Promise<void> {
  const aanvragen = await d.repo.aanvragen(['Klaar voor facturatie']);
  const demos = (await Promise.all(aanvragen.map(a => d.repo.demos(a.id)))).reduce((alle, x) => alle.concat(x), []);
  const [inzet, begeleiders, demoTypes] = await Promise.all([d.repo.inzetVoorDemos(demos.map(x => x.id)), d.repo.begeleiders(), d.repo.demoTypes()]);
  const rijen = demoRijen({ demos, aanvragen, inzet, begeleiders, demoTypes });
  const zonderDemo = aanvragen.filter(a => !demos.some(x => x.aanvraagId === a.id));
  const { factuurlijst } = await import(/* webpackChunkName: 'halplanning-excel' */ '../rapporten/excel');
  download(await factuurlijst(rijen, zonderDemo), 'Factuurlijst ' + bestandsdatum() + '.xlsx');
}

// ---- Hulp gezocht / komende demo's als afbeelding (FR-76, FR-77) ----

const useLijstStijl = makeStyles({
  // De afbeelding heeft een vaste opmaak, onafhankelijk van het thema van Teams.
  afbeelding: {
    backgroundColor: '#ffffff',
    color: '#242424',
    padding: '16px',
    width: '760px',
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif",
    fontSize: '14px'
  },
  kop: { fontSize: '18px', fontWeight: 600, marginBottom: '4px' },
  sub: { color: '#616161', marginBottom: '12px', fontSize: '12px' },
  tabel: {
    borderCollapse: 'collapse',
    width: '100%',
    '& th': { textAlign: 'left', backgroundColor: '#f0f0f0', padding: '6px 8px', fontWeight: 600, borderBottom: '2px solid #d1d1d1' },
    '& td': { padding: '6px 8px', borderBottom: '1px solid #e0e0e0', verticalAlign: 'top' }
  },
  hulp: { backgroundColor: '#fdf3f4' },
  vink: { color: '#107c10', fontWeight: 700, textAlign: 'center' },
  tekort: { color: '#c50f1f', fontWeight: 700 },
  // Opvallend: niet elke begeleider kan een borrel verzorgen.
  borrel: { display: 'inline-block', marginLeft: '6px', padding: '0 6px', borderRadius: '4px', backgroundColor: '#fff4ce', color: '#8a5300', fontWeight: 600, whiteSpace: 'nowrap' },
  begeleiders: { color: '#424242', fontStyle: 'italic', fontSize: '12px', marginTop: '2px' },
  voorbeeld: { overflowX: 'auto', maxWidth: '100%', border: '1px solid #e0e0e0' }
});

export function LijstDialoog(props: { soort?: 'hulp' | 'komend'; onSluit: () => void }): JSX.Element {
  const d = useDiensten();
  const s = useLijstStijl();
  const g = useGedeeldeStijl();
  const [weken, setWeken] = React.useState('4');
  const [rijen, setRijen] = React.useState<DemoRij[] | undefined>();
  const [fout, setFout] = React.useState<unknown>();
  const [bezig, voerUit] = useBezig();
  const afbeelding = React.useRef<HTMLDivElement>(null);

  const aantalWeken = Math.max(1, Math.min(52, parseInt(weken, 10) || 4));
  const van = begin(new Date());
  const tot = plusDagen(van, aantalWeken * 7);
  const hulp = props.soort === 'hulp';
  const titel = hulp ? 'Hulp gezocht' : 'Komende demo’s';

  React.useEffect(() => {
    if (!props.soort) return;
    setRijen(undefined);
    setFout(undefined);
    laadRijen(d, van, tot)
      .then(r => setRijen(hulp ? hulpGezocht(r.rijen, van, tot) : komendeDemos(r.rijen, van, tot)))
      .catch(setFout);
  }, [props.soort, aantalWeken]);

  const maakBlob = async (): Promise<Blob> => {
    const { toBlob } = await import(/* webpackChunkName: 'html-to-image' */ 'html-to-image');
    const blob = await toBlob(afbeelding.current as HTMLDivElement, { pixelRatio: 2, backgroundColor: '#ffffff' });
    if (!blob) throw new Error('De afbeelding kon niet worden gemaakt.');
    return blob;
  };
  const bestandsnaam = titel.replace(/[’']/g, '') + ' ' + bestandsdatum() + '.png';

  return (
    <Dialog open={!!props.soort} onOpenChange={(_, v) => !v.open && props.onSluit()}>
      <DialogSurface style={{ maxWidth: 840 }}>
        <DialogBody>
          <DialogTitle>{titel}</DialogTitle>
          <DialogContent>
            <Field label="Aantal weken vanaf vandaag" style={{ maxWidth: 200, marginBottom: 12 }}>
              <Input type="number" min={1} max={52} value={weken} onChange={(_, v) => setWeken(v.value)} />
            </Field>
            {fout ? <Fout fout={fout} /> : undefined}
            {!rijen && !fout && <Laden />}
            {rijen && (
              <div className={s.voorbeeld}>
                <div ref={afbeelding} className={s.afbeelding}>
                  <div className={s.kop}>{titel}</div>
                  <div className={s.sub}>
                    {datumKort(van)} t/m {datumKort(plusDagen(tot, -1))} · {rijen.length} demo{rijen.length === 1 ? '' : '’s'}
                  </div>
                  {rijen.length === 0 ? (
                    <div>{hulp ? 'Alle demo’s in deze periode hebben genoeg begeleiders.' : 'Geen demo’s in deze periode.'}</div>
                  ) : (
                    <table className={s.tabel}>
                      <thead>
                        <tr>
                          {!hulp && <th>Bezet</th>}
                          <th>Datum</th>
                          <th>Tijd</th>
                          <th>Duur</th>
                          <th>Titel</th>
                          <th>Type</th>
                          <th>Deelnemers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rijen.map(r => (
                          <tr key={r.demo.id} className={!r.compleet && !hulp ? s.hulp : undefined}>
                            {!hulp && (
                              <td className={r.compleet ? s.vink : s.tekort}>
                                {r.compleet ? '✓' : 'Nog ' + (r.demo.begeleidersNodig - r.toegewezen) + ' nodig'}
                              </td>
                            )}
                            <td>{datumNumeriek(r.demo.start)}</td>
                            <td>{tijd(r.demo.start)}</td>
                            <td>{duurTekst(r.demo.duurMinuten)}</td>
                            <td>
                              {r.demo.titel}
                              {borrelLabel(r.demo.borrel) && <span className={s.borrel}>{borrelLabel(r.demo.borrel)}</span>}
                              {begeleiderNamen(r) && <div className={s.begeleiders}>{begeleiderNamen(r)}</div>}
                            </td>
                            <td>{r.typeNaam}</td>
                            <td>{r.demo.aantalDeelnemers ?? '?'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
          <DialogActions fluid>
            <div className={g.knoppen} style={{ marginTop: 0 }}>
              {kanDelen() && (
                <Button icon={<ShareRegular />} disabled={!rijen || bezig} onClick={() => voerUit(async () => deel(await maakBlob(), bestandsnaam, titel))}>
                  Delen
                </Button>
              )}
              {kanKopieren() && (
                <Button icon={<CopyRegular />} disabled={!rijen || bezig} onClick={() => voerUit(async () => kopieer(await maakBlob()), 'Afbeelding gekopieerd')}>
                  Kopiëren
                </Button>
              )}
              <Button appearance="primary" icon={<ArrowDownloadRegular />} disabled={!rijen || bezig} onClick={() => voerUit(async () => download(await maakBlob(), bestandsnaam))}>
                Downloaden
              </Button>
              <Button onClick={props.onSluit}>Sluiten</Button>
            </div>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
