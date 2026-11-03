// Dagweergave van de gedeelde agenda (FR-38 t/m FR-40): alle afspraken van één dag, inclusief hele-dag-
// en meerdaagse afspraken, snel naar een datum springen en een tijd kiezen om een demo te plannen.

import * as React from 'react';
import { Button, Input, makeStyles, mergeClasses, ToggleButton, tokens, Tooltip } from '@fluentui/react-components';
import { ChevronLeftRegular, ChevronRightRegular, CalendarAddRegular } from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { AgendaItem, heleDagItems, plaatsItems } from '../logic/agenda';
import { begin, datumKort, datumLang, naarInvoerDatum, plusDagen, tijd, vanInvoer, zelfdeDag } from '../logic/datum';
import { CATEGORIE_BEVESTIGD, CATEGORIE_DEMO, CATEGORIE_VOORLOPIG, Demo } from '../model';
import { Fout, Laden, useGedeeldeStijl } from './algemeen';

const UUR_HOOGTE = 48;
const KWARTIER = 15;

const useStijl = makeStyles({
  navigatie: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' },
  dagtitel: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold, marginBottom: '8px' },
  snel: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' },
  heleDag: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' },
  heleDagItem: {
    padding: '4px 8px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    borderLeft: '4px solid ' + tokens.colorNeutralStroke1,
    fontSize: tokens.fontSizeBase200
  },
  scroll: {
    height: '60vh',
    minHeight: '320px',
    overflowY: 'auto',
    border: '1px solid ' + tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1
  },
  tijdlijn: { position: 'relative', height: 24 * UUR_HOOGTE + 'px', marginLeft: '48px', cursor: 'copy' },
  uur: {
    position: 'absolute',
    left: '-48px',
    right: 0,
    height: UUR_HOOGTE + 'px',
    borderTop: '1px solid ' + tokens.colorNeutralStroke2,
    pointerEvents: 'none'
  },
  uurLabel: { width: '44px', textAlign: 'right', fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3, transform: 'translateY(-50%)', backgroundColor: tokens.colorNeutralBackground1 },
  item: {
    position: 'absolute',
    boxSizing: 'border-box',
    padding: '2px 6px',
    borderRadius: tokens.borderRadiusSmall,
    overflow: 'hidden',
    fontSize: tokens.fontSizeBase200,
    lineHeight: '1.2',
    backgroundColor: tokens.colorNeutralBackground4,
    borderLeft: '4px solid ' + tokens.colorNeutralStroke1,
    cursor: 'default'
  },
  demo: { backgroundColor: tokens.colorBrandBackground2, borderLeftColor: tokens.colorBrandStroke1 },
  gereserveerd: { backgroundColor: tokens.colorPaletteYellowBackground1, borderLeftColor: tokens.colorPaletteYellowBorderActive },
  voorlopig: {
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.05) 6px, rgba(0,0,0,0.05) 12px)'
  },
  eigen: { outline: '2px solid ' + tokens.colorBrandStroke1 },
  itemTitel: { fontWeight: tokens.fontWeightSemibold },
  nu: { position: 'absolute', left: 0, right: 0, borderTop: '2px solid ' + tokens.colorPaletteRedBorder2, pointerEvents: 'none' }
});

function kleurKlasse(s: ReturnType<typeof useStijl>, item: AgendaItem): string | undefined {
  const c = item.categorieen;
  if (c.indexOf(CATEGORIE_DEMO) >= 0) return s.demo;
  if (c.indexOf(CATEGORIE_BEVESTIGD) >= 0 || c.indexOf(CATEGORIE_VOORLOPIG) >= 0) return s.gereserveerd;
  return undefined;
}

export function Dagweergave(props: { demos: Demo[]; onPlan: (start: Date) => void }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const eersteDemo = props.demos.filter(x => x.start >= begin(new Date()))[0];
  const [dag, setDag] = React.useState<Date>(() => begin(eersteDemo ? eersteDemo.start : new Date()));
  const [items, setItems] = React.useState<AgendaItem[] | undefined>();
  const [fout, setFout] = React.useState<unknown>();
  const scroll = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let actueel = true;
    setItems(undefined);
    setFout(undefined);
    d.graph
      .agendaItems(dag, plusDagen(dag, 1))
      .then(r => actueel && setItems(r))
      .catch(e => actueel && setFout(e));
    return () => {
      actueel = false;
    };
  }, [dag]);

  // Bij het openen naar de ochtend scrollen.
  React.useEffect(() => {
    if (scroll.current && items) scroll.current.scrollTop = 7.5 * UUR_HOOGTE;
  }, [items === undefined]);

  const eigenIds = React.useMemo(() => {
    const ids: Record<string, boolean> = {};
    props.demos.forEach(x => [x.eventIdDemo, x.eventIdOpbouwen, x.eventIdOpruimen].forEach(id => id && (ids[id] = true)));
    return ids;
  }, [props.demos]);

  const kiesTijd = (e: React.MouseEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest('[data-afspraak]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minuten = Math.floor(((e.clientY - rect.top) / UUR_HOOGTE) * 60 / KWARTIER) * KWARTIER;
    const start = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate(), 0, Math.max(0, Math.min(minuten, 23 * 60 + 45)));
    props.onPlan(start);
  };

  const snelDatums = props.demos
    .map(x => begin(x.start))
    .filter((x, i, arr) => arr.findIndex(y => y.getTime() === x.getTime()) === i);

  const geplaatst = items ? plaatsItems(items, dag) : [];
  const heleDag = items ? heleDagItems(items) : [];
  const nu = new Date();

  return (
    <div>
      <div className={s.navigatie}>
        <Tooltip content="Vorige dag" relationship="label">
          <Button icon={<ChevronLeftRegular />} onClick={() => setDag(plusDagen(dag, -1))} />
        </Tooltip>
        <Input type="date" value={naarInvoerDatum(dag)} onChange={(_, v) => { const x = vanInvoer(v.value, '00:00'); if (x) setDag(x); }} />
        <Tooltip content="Volgende dag" relationship="label">
          <Button icon={<ChevronRightRegular />} onClick={() => setDag(plusDagen(dag, 1))} />
        </Tooltip>
        <Button onClick={() => setDag(begin(new Date()))}>Vandaag</Button>
        <Button appearance="primary" icon={<CalendarAddRegular />} onClick={() => props.onPlan(new Date(dag.getFullYear(), dag.getMonth(), dag.getDate(), 14, 0))}>
          Demo plannen op deze dag
        </Button>
      </div>
      {snelDatums.length > 0 && (
        <div className={s.snel}>
          {snelDatums.map(x => (
            <ToggleButton key={x.getTime()} size="small" shape="circular" checked={zelfdeDag(x, dag)} onClick={() => setDag(x)}>
              {datumKort(x)}
            </ToggleButton>
          ))}
        </div>
      )}
      <div className={s.dagtitel}>{datumLang(dag)}</div>

      {fout ? <Fout fout={fout} /> : undefined}
      {!items && !fout && <Laden tekst="Agenda laden…" />}

      {items && (
        <>
          <div className={s.heleDag}>
            {heleDag.length === 0 && <div className={g.gedempt}>Geen afspraken voor de hele dag.</div>}
            {heleDag.map(i => (
              <div key={i.id} className={mergeClasses(s.heleDagItem, kleurKlasse(s, i))}>
                <span className={s.itemTitel}>{i.onderwerp}</span>
                {!zelfdeDag(i.start, plusDagen(i.eind, -1)) && ' (' + datumKort(i.start) + ' t/m ' + datumKort(plusDagen(i.eind, -1)) + ')'}
                {i.locatie && ' · ' + i.locatie}
              </div>
            ))}
          </div>
          <div className={s.scroll} ref={scroll}>
            <div className={s.tijdlijn} onClick={kiesTijd} title="Tik op een tijd om een demo te plannen">
              {Array.from({ length: 24 }, (_, u) => (
                <div key={u} className={s.uur} style={{ top: u * UUR_HOOGTE }}>
                  <div className={s.uurLabel}>{u > 0 ? (u < 10 ? '0' : '') + u + ':00' : ''}</div>
                </div>
              ))}
              {zelfdeDag(nu, dag) && <div className={s.nu} style={{ top: ((nu.getHours() * 60 + nu.getMinutes()) / 60) * UUR_HOOGTE }} />}
              {geplaatst.map(p => {
                const breedte = 100 / p.kolommen;
                const hoogte = Math.max(((p.totMin - p.vanMin) / 60) * UUR_HOOGTE, 18);
                return (
                  <div
                    key={p.item.id}
                    data-afspraak
                    className={mergeClasses(
                      s.item,
                      kleurKlasse(s, p.item),
                      p.item.showAs === 'tentative' && s.voorlopig,
                      eigenIds[p.item.id] && s.eigen
                    )}
                    style={{
                      top: (p.vanMin / 60) * UUR_HOOGTE,
                      height: hoogte,
                      left: 'calc(' + p.kolom * breedte + '% + 2px)',
                      width: 'calc(' + breedte + '% - 4px)'
                    }}
                    title={p.item.onderwerp + ' (' + tijd(p.item.start) + '–' + tijd(p.item.eind) + ')' + (p.item.locatie ? '\n' + p.item.locatie : '')}
                  >
                    <div className={s.itemTitel}>{p.item.onderwerp}</div>
                    <div>
                      {tijd(p.item.start)}–{tijd(p.item.eind)}
                      {p.item.locatie ? ' · ' + p.item.locatie : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
