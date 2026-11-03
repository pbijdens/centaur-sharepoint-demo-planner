// Demo's van een aanvraag: plannen, wijzigen, definitief maken, begeleiders en agenda (FR-50 t/m FR-62).

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
  Dropdown,
  Field,
  Input,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Option,
  Textarea,
  tokens
} from '@fluentui/react-components';
import { AddRegular, CalendarCheckmarkRegular, DeleteRegular, EditRegular, MoreVerticalRegular, PersonAddRegular, DismissRegular } from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { AfspraakSoort } from '../logic/agenda';
import { datumLang, duurTekst, naarInvoerDatum, naarInvoerTijd, tijd, vanInvoer } from '../logic/datum';
import {
  Aanvraag,
  Begeleider,
  BORREL_OPTIES,
  Borrel,
  Demo,
  DemoType,
  eindVan,
  Inzet,
  STANDAARD_BEGELEIDERS,
  STANDAARD_DUUR_MINUTEN,
  Status,
  WEDSTRIJD_OPTIES,
  Wedstrijd
} from '../model';
import { useBevestig, useBezig, useGedeeldeStijl } from './algemeen';

const useStijl = makeStyles({
  lijst: { display: 'flex', flexDirection: 'column', gap: '12px' },
  kop: { display: 'flex', alignItems: 'flex-start', gap: '8px' },
  titel: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  wanneer: { color: tokens.colorNeutralForeground2 },
  eigenschappen: {
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    columnGap: '12px',
    rowGap: '2px',
    margin: '8px 0',
    fontSize: tokens.fontSizeBase300
  },
  label: { color: tokens.colorNeutralForeground3 },
  begeleiders: { borderTop: '1px solid ' + tokens.colorNeutralStroke2, paddingTop: '8px', marginTop: '8px' },
  begeleider: { display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' },
  raster: {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: '1fr',
    '@media (min-width: 560px)': { gridTemplateColumns: '1fr 1fr' }
  },
  breed: { '@media (min-width: 560px)': { gridColumn: 'span 2' } }
});

export interface DemoFormulier {
  titel: string;
  datum: string;
  tijd: string;
  duur: string;
  demoTypeId?: number;
  aantalDeelnemers: string;
  begeleidersNodig: string;
  borrel: Borrel;
  wedstrijd: Wedstrijd;
  prijsafspraak: string;
  notitie: string;
}

function formulierVan(demo: Demo | undefined, aanvraag: Aanvraag, start?: Date): DemoFormulier {
  const s = demo ? demo.start : start || new Date(new Date().setHours(14, 0, 0, 0));
  return {
    titel: demo ? demo.titel : aanvraag.titel || aanvraag.naam,
    datum: naarInvoerDatum(s),
    tijd: naarInvoerTijd(s),
    duur: String(demo ? demo.duurMinuten : STANDAARD_DUUR_MINUTEN),
    demoTypeId: demo ? demo.demoTypeId : undefined,
    aantalDeelnemers: demo && demo.aantalDeelnemers !== undefined ? String(demo.aantalDeelnemers) : '',
    begeleidersNodig: String(demo ? demo.begeleidersNodig : STANDAARD_BEGELEIDERS),
    borrel: demo ? demo.borrel : 'onbekend',
    wedstrijd: demo ? demo.wedstrijd : 'onbekend',
    prijsafspraak: demo ? demo.prijsafspraak : '',
    notitie: demo ? demo.notitie : ''
  };
}

function getal(s: string): number | undefined {
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
}

/** Dialoog voor een nieuwe of bestaande demo. */
function DemoDialoog(props: {
  open: boolean;
  aanvraag: Aanvraag;
  demo?: Demo;
  start?: Date;
  demoTypes: DemoType[];
  onSluit: (gewijzigd: boolean, ontbrekend?: AfspraakSoort[]) => void;
}): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const [f, setF] = React.useState<DemoFormulier>(() => formulierVan(props.demo, props.aanvraag, props.start));
  const [bezig, voerUit] = useBezig();

  React.useEffect(() => {
    if (props.open) setF(formulierVan(props.demo, props.aanvraag, props.start));
  }, [props.open, props.demo, props.start]);

  const start = vanInvoer(f.datum, f.tijd);
  const duur = getal(f.duur);
  const geldig = !!start && !!duur && duur > 0 && !!f.titel.trim();
  const zet = (k: keyof DemoFormulier): ((_: unknown, v: { value: string }) => void) => (_, v) => setF({ ...f, [k]: v.value });
  const actieveTypes = props.demoTypes.filter(t => t.actief || t.id === f.demoTypeId);
  const gekozenType = props.demoTypes.filter(t => t.id === f.demoTypeId)[0];

  const bewaar = async (): Promise<void> => {
    if (!start || !duur) return;
    const velden: Partial<Demo> = {
      titel: f.titel.trim(),
      demoTypeId: f.demoTypeId,
      aantalDeelnemers: getal(f.aantalDeelnemers),
      begeleidersNodig: getal(f.begeleidersNodig) ?? STANDAARD_BEGELEIDERS,
      borrel: f.borrel,
      wedstrijd: f.wedstrijd,
      prijsafspraak: f.prijsafspraak,
      notitie: f.notitie
    };
    const r = await voerUit(async () => {
      if (props.demo) return d.acties.wijzigDemo(props.demo, { ...velden, start, duurMinuten: duur });
      await d.acties.planDemo(props.aanvraag, start, duur, velden);
      return { ontbrekend: [] as AfspraakSoort[] };
    }, props.demo ? 'Demo opgeslagen en agenda bijgewerkt' : 'Demo in potlood gezet in de agenda');
    if (r) props.onSluit(true, r.ontbrekend);
  };

  return (
    <Dialog open={props.open} onOpenChange={(_, v) => !v.open && props.onSluit(false)}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle>{props.demo ? 'Demo wijzigen' : 'Demo in potlood zetten'}</DialogTitle>
          <DialogContent>
            <div className={s.raster}>
              <Field label="Titel" required className={s.breed}>
                <Input value={f.titel} onChange={zet('titel')} />
              </Field>
              <Field label="Datum" required>
                <Input type="date" value={f.datum} onChange={zet('datum')} />
              </Field>
              <Field label="Begintijd" required>
                <Input type="time" step={900} value={f.tijd} onChange={zet('tijd')} />
              </Field>
              <Field label="Duur (minuten)" required>
                <Input type="number" min={15} step={15} value={f.duur} onChange={zet('duur')} />
              </Field>
              <Field label="Type demo">
                <Dropdown
                  value={gekozenType ? gekozenType.naam : ''}
                  selectedOptions={f.demoTypeId ? [String(f.demoTypeId)] : []}
                  onOptionSelect={(_, v) => setF({ ...f, demoTypeId: v.optionValue ? +v.optionValue : undefined })}
                  placeholder="Kies een type"
                >
                  {actieveTypes.map(t => (
                    <Option key={t.id} value={String(t.id)}>
                      {t.naam}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Aantal deelnemers">
                <Input type="number" min={0} value={f.aantalDeelnemers} onChange={zet('aantalDeelnemers')} />
              </Field>
              <Field label="Aantal begeleiders nodig">
                <Input type="number" min={0} value={f.begeleidersNodig} onChange={zet('begeleidersNodig')} />
              </Field>
              <Field label="Borrel gewenst">
                <Dropdown value={f.borrel} selectedOptions={[f.borrel]} onOptionSelect={(_, v) => setF({ ...f, borrel: v.optionValue as Borrel })}>
                  {BORREL_OPTIES.map(o => (
                    <Option key={o}>{o}</Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Wedstrijd gewenst">
                <Dropdown value={f.wedstrijd} selectedOptions={[f.wedstrijd]} onOptionSelect={(_, v) => setF({ ...f, wedstrijd: v.optionValue as Wedstrijd })}>
                  {WEDSTRIJD_OPTIES.map(o => (
                    <Option key={o}>{o}</Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Prijsafspraak" className={s.breed}>
                <Textarea value={f.prijsafspraak} onChange={zet('prijsafspraak')} resize="vertical" />
              </Field>
              <Field label="Notitie" className={s.breed}>
                <Textarea value={f.notitie} onChange={zet('notitie')} resize="vertical" />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => props.onSluit(false)} disabled={bezig}>
              Annuleren
            </Button>
            <Button appearance="primary" disabled={!geldig || bezig} onClick={bewaar}>
              {bezig ? 'Bezig…' : props.demo ? 'Opslaan' : 'In potlood zetten'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Definitief maken: datum, tijd en duur bevestigen (FR-51). */
function DefinitiefDialoog(props: { demo?: Demo; onSluit: (gelukt: boolean, ontbrekend?: AfspraakSoort[]) => void }): JSX.Element {
  const d = useDiensten();
  const [datum, setDatum] = React.useState('');
  const [begin, setBegin] = React.useState('');
  const [duur, setDuur] = React.useState('');
  const [bezig, voerUit] = useBezig();

  React.useEffect(() => {
    if (!props.demo) return;
    setDatum(naarInvoerDatum(props.demo.start));
    setBegin(naarInvoerTijd(props.demo.start));
    setDuur(String(props.demo.duurMinuten));
  }, [props.demo]);

  const start = vanInvoer(datum, begin);
  const minuten = getal(duur);

  const bevestig = async (): Promise<void> => {
    if (!props.demo || !start || !minuten) return;
    const r = await voerUit(() => d.acties.maakDefinitief(props.demo as Demo, start, minuten), 'Demo is definitief');
    if (r) props.onSluit(true, r.ontbrekend);
  };

  return (
    <Dialog open={!!props.demo} onOpenChange={(_, v) => !v.open && props.onSluit(false)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Demo definitief maken</DialogTitle>
          <DialogContent>
            <p>De afspraken in de agenda worden “Bezet” met de categorieën Demo en Gereserveerd (bevestigd).</p>
            <Field label="Datum">
              <Input type="date" value={datum} onChange={(_, v) => setDatum(v.value)} />
            </Field>
            <Field label="Begintijd">
              <Input type="time" step={900} value={begin} onChange={(_, v) => setBegin(v.value)} />
            </Field>
            <Field label="Duur (minuten)">
              <Input type="number" min={15} step={15} value={duur} onChange={(_, v) => setDuur(v.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => props.onSluit(false)} disabled={bezig}>
              Annuleren
            </Button>
            <Button appearance="primary" disabled={!start || !minuten || bezig} onClick={bevestig}>
              Definitief maken
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function Begeleiders(props: {
  demo: Demo;
  inzet: Inzet[];
  begeleiders: Begeleider[];
  onWijziging: (ontbrekend?: AfspraakSoort[]) => void;
}): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [keuze, setKeuze] = React.useState<string>('');
  const [duur, setDuur] = React.useState('');
  const [bezig, voerUit] = useBezig();

  const toegewezen = props.inzet.filter(i => i.demoId === props.demo.id);
  const naam = (id: number): string => (props.begeleiders.filter(b => b.id === id)[0] || { naam: '(onbekend)' }).naam;
  const beschikbaar = props.begeleiders.filter(b => b.actief && !toegewezen.some(i => i.begeleiderId === b.id));
  const gekozen = beschikbaar.filter(b => String(b.id) === keuze)[0];

  const voegToe = async (): Promise<void> => {
    if (!keuze) return;
    const r = await voerUit(() => d.acties.voegBegeleiderToe(props.demo.id, +keuze, getal(duur)), 'Begeleider toegevoegd');
    if (r) {
      setKeuze('');
      setDuur('');
      props.onWijziging(r.ontbrekend);
    }
  };

  const verwijder = async (i: Inzet): Promise<void> => {
    const r = await voerUit(() => d.acties.verwijderBegeleider(props.demo.id, i.id), 'Begeleider verwijderd');
    if (r) props.onWijziging(r.ontbrekend);
  };

  return (
    <div className={s.begeleiders}>
      <div className={s.label}>Begeleiders</div>
      {toegewezen.length === 0 && <div className={g.gedempt}>Nog niemand toegewezen.</div>}
      {toegewezen.map(i => (
        <div key={i.id} className={s.begeleider}>
          <span className={g.groei}>
            {naam(i.begeleiderId)}
            {i.duurMinuten ? ' (' + duurTekst(i.duurMinuten) + ')' : ''}
          </span>
          <Button size="small" appearance="subtle" icon={<DismissRegular />} aria-label="Verwijderen" disabled={bezig} onClick={() => verwijder(i)} />
        </div>
      ))}
      <div className={g.rij} style={{ marginTop: 6 }}>
        <Dropdown
          size="small"
          placeholder="Begeleider kiezen"
          value={gekozen ? gekozen.naam : ''}
          selectedOptions={keuze ? [keuze] : []}
          onOptionSelect={(_, v) => setKeuze(v.optionValue || '')}
          style={{ minWidth: 160 }}
        >
          {beschikbaar.map(b => (
            <Option key={b.id} value={String(b.id)}>
              {b.naam}
            </Option>
          ))}
        </Dropdown>
        <Input size="small" type="number" min={15} step={15} placeholder="Duur (min, optioneel)" value={duur} onChange={(_, v) => setDuur(v.value)} style={{ width: 170 }} />
        <Button size="small" icon={<PersonAddRegular />} disabled={!keuze || bezig} onClick={voegToe}>
          Toevoegen
        </Button>
      </div>
    </div>
  );
}

export function Demos(props: {
  aanvraag: Aanvraag;
  demos: Demo[];
  inzet: Inzet[];
  begeleiders: Begeleider[];
  demoTypes: DemoType[];
  herlaad: () => Promise<void>;
  /** Starttijd gekozen in de dagweergave: opent direct de dialoog voor een nieuwe demo. */
  planStart?: Date;
  onPlanAfgehandeld: () => void;
  stelStatusVoor: (status: Status, reden: string) => void;
}): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [dialoog, setDialoog] = React.useState<{ demo?: Demo; start?: Date } | undefined>();
  const [definitief, setDefinitief] = React.useState<Demo | undefined>();
  const [ontbrekend, setOntbrekend] = React.useState<Record<number, AfspraakSoort[]>>({});
  const [bezig, voerUit] = useBezig();
  const [bevestigDialoog, bevestig] = useBevestig();

  React.useEffect(() => {
    if (props.planStart) setDialoog({ start: props.planStart });
  }, [props.planStart]);

  const typeNaam = (id?: number): string => (props.demoTypes.filter(t => t.id === id)[0] || { naam: 'Onbekend' }).naam;

  const herstel = async (demo: Demo): Promise<void> => {
    const r = await voerUit(() => d.acties.synchroniseerDemo(demo.id, true), 'Agenda-afspraken aangemaakt');
    if (r) {
      setOntbrekend({ ...ontbrekend, [demo.id]: [] });
      await props.herlaad();
    }
  };

  const verwijder = async (demo: Demo): Promise<void> => {
    const ok = await bevestig({
      titel: 'Demo verwijderen?',
      tekst: 'De demo, de toegewezen begeleiders en de drie agenda-afspraken (opbouwen, demo, opruimen) worden verwijderd.',
      knop: 'Verwijderen',
      gevaarlijk: true
    });
    if (!ok) return;
    await voerUit(() => d.acties.verwijderDemo(demo), 'Demo verwijderd');
    await props.herlaad();
  };

  return (
    <div>
      {bevestigDialoog}
      <div className={g.knoppen} style={{ marginBottom: 12, marginTop: 0 }}>
        <Button appearance="primary" icon={<AddRegular />} onClick={() => setDialoog({})}>
          Nieuwe demo
        </Button>
      </div>
      <div className={s.lijst}>
        {props.demos.length === 0 && <div className={g.leeg}>Nog geen demo’s. Kies “Nieuwe demo” of kies een tijd in de agenda.</div>}
        {props.demos.map(demo => {
          const aantal = props.inzet.filter(i => i.demoId === demo.id).length;
          const compleet = aantal >= demo.begeleidersNodig;
          const geenAfspraken = !demo.eventIdDemo && !demo.eventIdOpbouwen && !demo.eventIdOpruimen;
          const mist = ontbrekend[demo.id] || [];
          return (
            <div key={demo.id} className={g.kaart}>
              <div className={s.kop}>
                <div className={g.groei}>
                  <div className={s.titel}>{demo.titel}</div>
                  <div className={s.wanneer}>
                    {datumLang(demo.start)}, {tijd(demo.start)}–{tijd(eindVan(demo))} ({duurTekst(demo.duurMinuten)})
                  </div>
                </div>
                <Badge appearance={demo.planningsstatus === 'Definitief' ? 'filled' : 'outline'} color={demo.planningsstatus === 'Definitief' ? 'success' : 'warning'}>
                  {demo.planningsstatus}
                </Badge>
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <Button appearance="subtle" icon={<MoreVerticalRegular />} aria-label="Acties voor demo" />
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem icon={<EditRegular />} onClick={() => setDialoog({ demo })}>
                        Wijzigen
                      </MenuItem>
                      {demo.planningsstatus !== 'Definitief' && (
                        <MenuItem icon={<CalendarCheckmarkRegular />} onClick={() => setDefinitief(demo)}>
                          Definitief maken
                        </MenuItem>
                      )}
                      <MenuItem icon={<DeleteRegular />} onClick={() => verwijder(demo)}>
                        Verwijderen
                      </MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
              </div>

              {(geenAfspraken || mist.length > 0) && (
                <MessageBar intent="warning" style={{ marginTop: 8 }}>
                  <MessageBarBody>
                    {geenAfspraken
                      ? 'Deze demo staat niet in de agenda.'
                      : 'Niet alle afspraken bestaan nog in de agenda (' + mist.join(', ') + ').'}
                  </MessageBarBody>
                  <MessageBarActions>
                    <Button size="small" disabled={bezig} onClick={() => herstel(demo)}>
                      {geenAfspraken ? 'Afspraken aanmaken' : 'Opnieuw aanmaken'}
                    </Button>
                  </MessageBarActions>
                </MessageBar>
              )}

              <div className={s.eigenschappen}>
                <span className={s.label}>Type</span>
                <span>{typeNaam(demo.demoTypeId)}</span>
                <span className={s.label}>Deelnemers</span>
                <span>{demo.aantalDeelnemers ?? 'onbekend'}</span>
                <span className={s.label}>Begeleiders</span>
                <span>
                  <Badge appearance="tint" color={compleet ? 'success' : 'danger'}>
                    {aantal} / {demo.begeleidersNodig}
                  </Badge>
                </span>
                <span className={s.label}>Borrel</span>
                <span>{demo.borrel}</span>
                <span className={s.label}>Wedstrijd</span>
                <span>{demo.wedstrijd}</span>
                {demo.prijsafspraak && (
                  <>
                    <span className={s.label}>Prijsafspraak</span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{demo.prijsafspraak}</span>
                  </>
                )}
                {demo.notitie && (
                  <>
                    <span className={s.label}>Notitie</span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{demo.notitie}</span>
                  </>
                )}
              </div>

              <Begeleiders
                demo={demo}
                inzet={props.inzet}
                begeleiders={props.begeleiders}
                onWijziging={m => {
                  if (m && m.length) setOntbrekend({ ...ontbrekend, [demo.id]: m });
                  props.herlaad().catch(() => undefined);
                }}
              />
            </div>
          );
        })}
      </div>

      <DemoDialoog
        open={!!dialoog}
        aanvraag={props.aanvraag}
        demo={dialoog?.demo}
        start={dialoog?.start}
        demoTypes={props.demoTypes}
        onSluit={(gewijzigd, mist) => {
          const nieuw = dialoog && !dialoog.demo;
          if (dialoog && dialoog.demo && mist && mist.length) setOntbrekend({ ...ontbrekend, [dialoog.demo.id]: mist });
          setDialoog(undefined);
          props.onPlanAfgehandeld();
          if (gewijzigd) {
            props.herlaad().catch(() => undefined);
            if (nieuw && props.aanvraag.status === 'Nieuw') props.stelStatusVoor('In afwachting', 'De demo staat in potlood in de agenda.');
          }
        }}
      />
      <DefinitiefDialoog
        demo={definitief}
        onSluit={(gelukt, mist) => {
          if (definitief && mist && mist.length) setOntbrekend({ ...ontbrekend, [definitief.id]: mist });
          setDefinitief(undefined);
          if (gelukt) {
            props.herlaad().catch(() => undefined);
            if (props.aanvraag.status === 'Nieuw' || props.aanvraag.status === 'In afwachting') {
              props.stelStatusVoor('Bevestigd', 'De demo is definitief gemaakt.');
            }
          }
        }}
      />
    </div>
  );
}
