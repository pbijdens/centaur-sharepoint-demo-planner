// Begeleiders indelen bij komende demo's (FR-63 t/m FR-65, UC-22).

import * as React from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  GriffelStyle,
  Input,
  makeStyles,
  mergeClasses,
  shorthands,
  Spinner,
  Switch,
  tokens
} from '@fluentui/react-components';
import {
  AddRegular,
  ArrowClockwiseRegular,
  ArrowLeftRegular,
  CheckmarkCircleFilled,
  CircleRegular,
  DismissRegular,
  OpenRegular,
  SearchRegular,
  SubtractRegular,
  WarningRegular
} from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { begin, datumLang, tijd } from '../logic/datum';
import {
  aantalPlekken,
  demosVoorIndeling,
  INDELING_STATUSSEN,
  kleurIndex,
  OpenWijziging,
  opNaam,
  overlapVoor,
  perDag,
  toegewezenIds
} from '../logic/indeling';
import { borrelLabel } from '../logic/rapportage';
import { Aanvraag, Begeleider, Demo, DemoType, eindVan, Inzet } from '../model';
import { Fout, Laden, StatusBadge, useGedeeldeStijl, useMelding } from './algemeen';

// Fluent-kleuren met varianten voor licht en donker thema. Volgorde: zo verschillend mogelijk na elkaar.
const KLEUREN = [
  'Blue',
  'Pumpkin',
  'Forest',
  'Grape',
  'Cranberry',
  'Teal',
  'Marigold',
  'Magenta',
  'Brown',
  'Navy',
  'LightGreen',
  'Lavender',
  'Peach',
  'Steel',
  'Gold',
  'Plum',
  'Seafoam',
  'Cornflower',
  'Berry',
  'DarkGreen'
];

const token = (naam: string): string => (tokens as unknown as Record<string, string>)[naam];

const useKleur = makeStyles(
  KLEUREN.reduce<Record<string, GriffelStyle>>((uit, k, i) => {
    uit['k' + i] = {
      backgroundColor: token('colorPalette' + k + 'Background2'),
      color: token('colorPalette' + k + 'Foreground2'),
      ...shorthands.borderColor(token('colorPalette' + k + 'BorderActive'))
    };
    return uit;
  }, {})
);

const useStijl = makeStyles({
  titel: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  filters: { display: 'flex', flexWrap: 'wrap', columnGap: '16px', alignItems: 'center', marginBottom: '8px' },
  samenvatting: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, marginBottom: '12px' },
  dag: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    margin: '16px 0 6px',
    '::first-letter': { textTransform: 'uppercase' }
  },
  lijst: { display: 'flex', flexDirection: 'column', gap: '8px' },
  kaartKop: { display: 'flex', alignItems: 'flex-start', gap: '8px' },
  tijd: { fontWeight: tokens.fontWeightSemibold, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  demoTitel: {
    fontWeight: tokens.fontWeightSemibold,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    ':hover': { textDecoration: 'underline' }
  },
  details: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '4px 8px',
    marginTop: '2px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3
  },
  borrel: { color: tokens.colorPaletteMarigoldForeground2, fontWeight: tokens.fontWeightSemibold },
  plekken: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' },
  plek: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    minHeight: '36px',
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '0 2px 0 12px',
    borderRadius: '18px',
    border: '1px solid',
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold
  },
  plekNaam: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  plekKruis: { minWidth: '32px', height: '32px', color: 'inherit' },
  bezig: { opacity: 0.6 },
  leegPlek: {
    minHeight: '36px',
    borderRadius: '18px',
    border: '1px dashed ' + tokens.colorNeutralStroke1,
    color: tokens.colorNeutralForeground3,
    backgroundColor: 'transparent',
    padding: '0 14px',
    fontWeight: tokens.fontWeightRegular
  },
  extraPlek: { minWidth: '36px', minHeight: '36px', borderRadius: '18px' },
  // Keuzelijst
  stapper: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' },
  stapperWaarde: { minWidth: '24px', textAlign: 'center', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  keuzes: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' },
  keuze: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    minHeight: '44px',
    padding: '6px 10px',
    boxSizing: 'border-box',
    border: '1px solid ' + tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase300,
    textAlign: 'left',
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover }
  },
  keuzeGekozen: { ...shorthands.borderColor(tokens.colorBrandStroke1), backgroundColor: tokens.colorBrandBackground2 },
  stip: { width: '22px', height: '22px', borderRadius: '50%', border: '2px solid', flexShrink: 0 },
  waarschuwing: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: tokens.fontSizeBase200, color: tokens.colorPaletteDarkOrangeForeground1 },
  vink: { fontSize: '24px', color: tokens.colorBrandForeground1, flexShrink: 0 },
  leegVink: { fontSize: '24px', color: tokens.colorNeutralForeground4, flexShrink: 0 }
});

interface Gegevens {
  demos: Demo[];
  aanvragen: Record<number, Aanvraag>;
  inzet: Inzet[];
  begeleiders: Begeleider[];
  demoTypes: DemoType[];
}

/** Keuzelijst voor één demo: begeleiders aan- en uitzetten en het aantal plekken wijzigen (FR-64). */
function Kiezer(props: {
  demo?: Demo;
  toegewezen: number[];
  nodig: number;
  begeleiders: Begeleider[];
  kleur: (id: number) => string;
  overlap: (demo: Demo, begeleiderId: number) => Demo[];
  onWissel: (begeleiderId: number) => void;
  onNodig: (n: number) => void;
  onSluit: () => void;
}): JSX.Element {
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [zoek, setZoek] = React.useState('');
  const demo = props.demo;
  const demoId = demo ? demo.id : undefined;

  React.useEffect(() => setZoek(''), [demoId]);

  const term = zoek.trim().toLowerCase();
  const keuzes = opNaam(props.begeleiders.filter(b => b.actief || props.toegewezen.indexOf(b.id) >= 0)).filter(
    b => !term || b.naam.toLowerCase().indexOf(term) >= 0
  );

  return (
    <Dialog open={!!demo} onOpenChange={(_, v) => !v.open && props.onSluit()}>
      <DialogSurface style={{ maxWidth: 480 }}>
        <DialogBody>
          <DialogTitle>{demo ? demo.titel : ''}</DialogTitle>
          <DialogContent>
            {demo && (
              <>
                <div className={g.gedempt} style={{ marginBottom: 12 }}>
                  {datumLang(demo.start)}, {tijd(demo.start)}–{tijd(eindVan(demo))}
                </div>
                <div className={s.stapper}>
                  <span className={g.groei}>
                    Plekken ({props.toegewezen.length} ingedeeld)
                  </span>
                  <Button icon={<SubtractRegular />} aria-label="Plek minder" disabled={props.nodig <= 0} onClick={() => props.onNodig(props.nodig - 1)} />
                  <span className={s.stapperWaarde} aria-live="polite">
                    {props.nodig}
                  </span>
                  <Button icon={<AddRegular />} aria-label="Plek erbij" disabled={props.nodig >= 20} onClick={() => props.onNodig(props.nodig + 1)} />
                </div>
                {props.begeleiders.length > 8 && (
                  <Input contentBefore={<SearchRegular />} placeholder="Zoek een begeleider" value={zoek} onChange={(_, v) => setZoek(v.value)} style={{ width: '100%' }} />
                )}
                <div className={s.keuzes}>
                  {keuzes.length === 0 && <div className={g.leeg}>Geen begeleiders gevonden.</div>}
                  {keuzes.map(b => {
                    const gekozen = props.toegewezen.indexOf(b.id) >= 0;
                    const overlap = props.overlap(demo, b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        role="checkbox"
                        aria-checked={gekozen}
                        className={mergeClasses(s.keuze, gekozen && s.keuzeGekozen)}
                        onClick={() => props.onWissel(b.id)}
                      >
                        <span className={mergeClasses(s.stip, props.kleur(b.id))} />
                        <span className={g.groei}>
                          <div>
                            {b.naam}
                            {!b.actief && <span className={g.gedempt}> (inactief)</span>}
                          </div>
                          {overlap.length > 0 && (
                            <div className={s.waarschuwing}>
                              <WarningRegular />
                              Staat al bij {overlap.map(o => o.titel + ' (' + tijd(o.start) + ')').join(', ')}
                            </div>
                          )}
                        </span>
                        {gekozen ? <CheckmarkCircleFilled className={s.vink} /> : <CircleRegular className={s.leegVink} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={props.onSluit}>
              Klaar
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function BegeleidersIndelen(props: { terug: () => void; openAanvraag: (id: number) => void }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const kleurStijl = useKleur();
  const melding = useMelding();
  const [gegevens, setGegevens] = React.useState<Gegevens | undefined>();
  const [fout, setFout] = React.useState<unknown>();
  const [eerdere, setEerdere] = React.useState(false);
  const [alleenOpen, setAlleenOpen] = React.useState(false);
  const [open, setOpen] = React.useState<OpenWijziging[]>([]);
  const [nodigLokaal, setNodigLokaal] = React.useState<Record<number, number>>({});
  const [kiezerVoor, setKiezerVoor] = React.useState<number | undefined>();

  // Per demo een wachtrij, zodat opeenvolgende tikken na elkaar worden opgeslagen (de agenda-synchronisatie van
  // één demo mag niet door elkaar lopen). Andere demo's blijven intussen gewoon bruikbaar.
  const wachtrij = React.useRef<Record<number, Promise<void>>>({});
  const afgerond = React.useRef<OpenWijziging[]>([]);
  const nodigTimer = React.useRef<Record<number, number>>({});

  const laad = React.useCallback(async () => {
    setFout(undefined);
    try {
      const aanvragen = await d.repo.aanvragen(INDELING_STATUSSEN);
      const [demos, begeleiders, demoTypes] = await Promise.all([
        d.repo.demosVoorAanvragen(aanvragen.map(a => a.id)),
        d.repo.begeleiders(),
        d.repo.demoTypes()
      ]);
      const inAgenda = demos.filter(x => !!x.eventIdDemo);
      const inzet = await d.repo.inzetVoorDemos(inAgenda.map(x => x.id));
      const perId: Record<number, Aanvraag> = {};
      aanvragen.forEach(a => (perId[a.id] = a));
      setGegevens({ demos: inAgenda, aanvragen: perId, inzet, begeleiders, demoTypes });
    } catch (e) {
      setFout(e);
    }
  }, [d]);

  React.useEffect(() => {
    laad().catch(() => undefined);
  }, [laad]);

  const herlaadDemo = async (demoId: number): Promise<void> => {
    const [demo, inzet] = await Promise.all([d.repo.demo(demoId), d.repo.inzetVoorDemos([demoId])]);
    setGegevens(x =>
      x && {
        ...x,
        demos: x.demos.map(o => (o.id === demoId ? demo : o)),
        inzet: x.inzet.filter(i => i.demoId !== demoId).concat(inzet)
      }
    );
    setNodigLokaal(n => {
      if (n[demoId] === undefined || nodigTimer.current[demoId] || n[demoId] !== demo.begeleidersNodig) return n;
      const kopie = { ...n };
      delete kopie[demoId];
      return kopie;
    });
  };

  /** Zet werk voor een demo in de wachtrij; daarna wordt de demo opnieuw gelezen. */
  const inWachtrij = (demoId: number, werk: () => Promise<void>, wijziging?: OpenWijziging): void => {
    if (wijziging) setOpen(o => o.concat([wijziging]));
    const vorige = wachtrij.current[demoId] || Promise.resolve();
    const deze: Promise<void> = vorige
      .then(werk)
      .catch(e => melding.fout(e))
      .then(async () => {
        if (wijziging) afgerond.current.push(wijziging);
        if (wachtrij.current[demoId] !== deze) return;
        delete wachtrij.current[demoId];
        try {
          await herlaadDemo(demoId);
        } catch (e) {
          melding.fout(e);
        }
        const klaar = afgerond.current.filter(w => w.demoId === demoId);
        afgerond.current = afgerond.current.filter(w => w.demoId !== demoId);
        setOpen(o => o.filter(w => klaar.indexOf(w) < 0));
      });
    wachtrij.current[demoId] = deze;
  };

  const toegewezen = (demoId: number): number[] => (gegevens ? toegewezenIds(demoId, gegevens.inzet, open) : []);

  const wissel = (demoId: number, begeleiderId: number): void => {
    const erbij = toegewezen(demoId).indexOf(begeleiderId) < 0;
    const wijziging: OpenWijziging = { soort: erbij ? 'toevoegen' : 'verwijderen', demoId, begeleiderId };
    inWachtrij(
      demoId,
      async () => {
        const huidig = await d.repo.inzetVoorDemos([demoId]);
        const bestaand = huidig.filter(i => i.begeleiderId === begeleiderId)[0];
        if (erbij && !bestaand) await d.acties.voegBegeleiderToe(demoId, begeleiderId);
        if (!erbij && bestaand) await d.acties.verwijderBegeleider(demoId, bestaand.id);
      },
      wijziging
    );
  };

  const nodigVan = (demo: Demo): number => (nodigLokaal[demo.id] !== undefined ? nodigLokaal[demo.id] : demo.begeleidersNodig);

  // Het aantal plekken pas opslaan als er even niet meer is getikt: één wijziging en één agenda-update.
  const zetNodig = (demoId: number, n: number): void => {
    setNodigLokaal(x => ({ ...x, [demoId]: n }));
    window.clearTimeout(nodigTimer.current[demoId]);
    nodigTimer.current[demoId] = window.setTimeout(() => {
      delete nodigTimer.current[demoId];
      inWachtrij(demoId, async () => {
        const demo = await d.repo.demo(demoId);
        if (demo.begeleidersNodig !== n) await d.acties.wijzigDemo(demo, { begeleidersNodig: n });
      });
    }, 700);
  };

  React.useEffect(() => {
    const timers = nodigTimer.current;
    return () => Object.keys(timers).forEach(k => window.clearTimeout(timers[+k]));
  }, []);

  const alleBegeleiders = gegevens ? gegevens.begeleiders : undefined;
  const kleuren = React.useMemo(() => kleurIndex(alleBegeleiders || [], KLEUREN.length), [alleBegeleiders]);
  const kleur = (id: number): string => (kleurStijl as Record<string, string>)['k' + (kleuren[id] || 0)];
  const begeleider = (id: number): Begeleider =>
    (gegevens && gegevens.begeleiders.filter(b => b.id === id)[0]) || { id, naam: '(onbekend)', telefoon: '', email: '', actief: false };

  const kop = (
    <div className={g.kop}>
      <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={props.terug} aria-label="Terug" />
      <div className={mergeClasses(g.groei, s.titel)}>Begeleiders indelen</div>
      <Button appearance="subtle" icon={<ArrowClockwiseRegular />} aria-label="Vernieuwen" disabled={open.length > 0} onClick={() => laad()} />
    </div>
  );

  if (fout) {
    return (
      <div className={g.scherm}>
        {kop}
        <Fout fout={fout} />
      </div>
    );
  }
  if (!gegevens) {
    return (
      <div className={g.scherm}>
        {kop}
        <Laden />
      </div>
    );
  }

  const zichtbaar = demosVoorIndeling(gegevens.demos, Object.keys(gegevens.aanvragen).map(k => gegevens.aanvragen[+k]), eerdere ? undefined : begin(new Date()));
  const openPlekken = (demo: Demo): number => Math.max(0, nodigVan(demo) - toegewezen(demo.id).length);
  const lijst = alleenOpen ? zichtbaar.filter(x => openPlekken(x) > 0) : zichtbaar;
  const totaalOpen = zichtbaar.reduce((n, x) => n + openPlekken(x), 0);
  const typeNaam = (id?: number): string => (gegevens.demoTypes.filter(t => t.id === id)[0] || { naam: '' }).naam;
  const kiezerDemo = gegevens.demos.filter(x => x.id === kiezerVoor)[0];

  return (
    <div className={g.scherm}>
      {kop}
      <div className={s.filters}>
        <Switch label="Alleen open plekken" checked={alleenOpen} onChange={(_, v) => setAlleenOpen(v.checked)} />
        <Switch label="Ook eerdere demo’s" checked={eerdere} onChange={(_, v) => setEerdere(v.checked)} />
      </div>
      <div className={s.samenvatting}>
        {zichtbaar.length} demo{zichtbaar.length === 1 ? '' : '’s'} · {totaalOpen === 0 ? 'alles is ingedeeld' : totaalOpen + ' open plek' + (totaalOpen === 1 ? '' : 'ken')}
      </div>

      {lijst.length === 0 && (
        <div className={g.leeg}>
          {alleenOpen && zichtbaar.length > 0 ? 'Alle demo’s hebben genoeg begeleiders.' : 'Geen demo’s in de agenda bij aanvragen die in afwachting of bevestigd zijn.'}
        </div>
      )}

      {perDag(lijst).map(groep => (
        <div key={groep.dag.getTime()}>
          <div className={s.dag}>{datumLang(groep.dag)}</div>
          <div className={s.lijst}>
            {groep.items.map(demo => {
              const ids = toegewezen(demo.id);
              const namen = opNaam(ids.map(begeleider));
              const nodig = nodigVan(demo);
              const leeg = aantalPlekken(nodig, ids.length) - ids.length;
              const aanvraag = gegevens.aanvragen[demo.aanvraagId];
              const bezigMet = (id: number): boolean => open.some(w => w.demoId === demo.id && w.begeleiderId === id);
              const borrel = borrelLabel(demo.borrel);
              const details = [typeNaam(demo.demoTypeId), demo.aantalDeelnemers !== undefined ? demo.aantalDeelnemers + ' deelnemers' : ''].filter(x => !!x);
              return (
                <div key={demo.id} className={g.kaart}>
                  <div className={s.kaartKop}>
                    <span className={s.tijd}>
                      {tijd(demo.start)}–{tijd(eindVan(demo))}
                    </span>
                    <span
                      className={mergeClasses(g.groei, s.demoTitel)}
                      role="link"
                      tabIndex={0}
                      title="Aanvraag openen"
                      onClick={() => props.openAanvraag(demo.aanvraagId)}
                      onKeyDown={e => e.key === 'Enter' && props.openAanvraag(demo.aanvraagId)}
                    >
                      {demo.titel}
                    </span>
                    <Badge appearance="tint" color={leeg === 0 ? 'success' : 'danger'}>
                      {ids.length} / {nodig}
                    </Badge>
                  </div>
                  <div className={s.details}>
                    {aanvraag && <StatusBadge status={aanvraag.status} size="small" />}
                    <Badge size="small" appearance="outline" color={demo.planningsstatus === 'Definitief' ? 'success' : 'warning'}>
                      {demo.planningsstatus}
                    </Badge>
                    {details.length > 0 && <span>{details.join(' · ')}</span>}
                    {borrel && <span className={s.borrel}>{borrel}</span>}
                  </div>
                  <div className={s.plekken}>
                    {namen.map(b => (
                      <span key={b.id} className={mergeClasses(s.plek, kleur(b.id), bezigMet(b.id) && s.bezig)}>
                        <span className={s.plekNaam}>{b.naam}</span>
                        {bezigMet(b.id) ? (
                          <Spinner size="extra-tiny" style={{ width: 32, justifyContent: 'center' }} />
                        ) : (
                          <Button
                            appearance="transparent"
                            size="small"
                            className={s.plekKruis}
                            icon={<DismissRegular />}
                            aria-label={b.naam + ' weghalen'}
                            onClick={() => wissel(demo.id, b.id)}
                          />
                        )}
                      </span>
                    ))}
                    {Array.from({ length: leeg }).map((_, i) => (
                      <Button key={'leeg' + i} className={s.leegPlek} icon={<AddRegular />} onClick={() => setKiezerVoor(demo.id)}>
                        Begeleider
                      </Button>
                    ))}
                    {leeg === 0 && (
                      <Button appearance="subtle" className={s.extraPlek} icon={<AddRegular />} aria-label="Begeleider toevoegen" onClick={() => setKiezerVoor(demo.id)} />
                    )}
                    <Button
                      appearance="subtle"
                      className={s.extraPlek}
                      icon={<OpenRegular />}
                      aria-label="Aanvraag openen"
                      title="Aanvraag openen"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => props.openAanvraag(demo.aanvraagId)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Kiezer
        demo={kiezerDemo}
        toegewezen={kiezerDemo ? toegewezen(kiezerDemo.id) : []}
        nodig={kiezerDemo ? nodigVan(kiezerDemo) : 0}
        begeleiders={gegevens.begeleiders}
        kleur={kleur}
        overlap={(demo, id) => overlapVoor(demo, id, gegevens.demos, toegewezen)}
        onWissel={id => kiezerDemo && wissel(kiezerDemo.id, id)}
        onNodig={n => kiezerDemo && zetNodig(kiezerDemo.id, n)}
        onSluit={() => setKiezerVoor(undefined)}
      />
    </div>
  );
}
