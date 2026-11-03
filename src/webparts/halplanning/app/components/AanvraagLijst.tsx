// Startscherm: lijst van aanvragen met statusfilters, zoeken en sorteren (FR-10 t/m FR-19).

import * as React from 'react';
import {
  Button,
  Input,
  makeStyles,
  Menu,
  MenuDivider,
  MenuItem,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  ToggleButton,
  tokens,
  Tooltip
} from '@fluentui/react-components';
import {
  AddRegular,
  ArrowClockwiseRegular,
  ArrowSortRegular,
  CalendarErrorRegular,
  CalendarLtrRegular,
  CheckmarkCircleRegular,
  MailUnreadRegular,
  MoreVerticalRegular,
  PeopleErrorRegular,
  SearchRegular
} from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { AanvraagSortering, demoOverzichtPerAanvraag, DemoOverzicht, SORTERINGEN, sorteerAanvragen } from '../logic/aanvragen';
import { datumTijdKort, tijdstipRelatief } from '../logic/datum';
import { Aanvraag, OPEN_STATUSSEN, Status, STATUSSEN } from '../model';
import { Fout, Laden, StatusBadge, useBevestig, useBezig, useGedeeldeStijl } from './algemeen';

const FILTER_SLEUTEL = 'halplanning.statusfilter';
const SORTERING_SLEUTEL = 'halplanning.sortering';
const VERVERS_MS = 60000;

const useStijl = makeStyles({
  filters: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' },
  lijst: { display: 'flex', flexDirection: 'column', gap: '6px' },
  rij: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 8px 10px 12px',
    borderRadius: tokens.borderRadiusMedium,
    border: '1px solid ' + tokens.colorNeutralStroke2,
    borderLeft: '4px solid transparent',
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover }
  },
  onbeantwoord: {
    borderLeft: '4px solid ' + tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
    ':hover': { backgroundColor: tokens.colorBrandBackground2Hover }
  },
  tekst: { flexGrow: 1, minWidth: 0 },
  titel: { fontSize: tokens.fontSizeBase400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  vet: { fontWeight: tokens.fontWeightBold },
  sub: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  rechts: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 },
  tijd: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  demo: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2, whiteSpace: 'nowrap' },
  demoNadruk: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  demoVoorbij: { color: tokens.colorNeutralForeground3 },
  meer: {
    padding: '0 5px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold
  },
  sorteer: { marginLeft: 'auto' },
  // Altijd even breed, ook zonder iconen, zodat alle titels gelijk uitlijnen.
  indicatoren: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0, width: '20px', fontSize: '20px' },
  indicator: { display: 'flex', color: tokens.colorBrandForeground1 },
  waarschuwing: { display: 'flex', color: tokens.colorPaletteRedForeground1 },
  zoek: { flexGrow: 1, minWidth: '180px' }
});

function meervoud(aantal: number, enkel: string, meer: string): string {
  return aantal + ' ' + (aantal === 1 ? enkel : meer);
}

function leesFilter(): Status[] {
  try {
    const f = JSON.parse(localStorage.getItem(FILTER_SLEUTEL) || '') as Status[];
    if (Array.isArray(f) && f.length) return f.filter(s => STATUSSEN.indexOf(s) >= 0);
  } catch {
    // Geen of ongeldig opgeslagen filter: standaard.
  }
  return OPEN_STATUSSEN.slice();
}

function leesSortering(): AanvraagSortering {
  const s = localStorage.getItem(SORTERING_SLEUTEL);
  return SORTERINGEN.some(x => x.waarde === s) ? (s as AanvraagSortering) : 'bericht';
}

export function AanvraagLijst(props: { open: (id: number) => void; nieuw: () => void }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [filter, setFilter] = React.useState<Status[]>(leesFilter);
  const [zoek, setZoek] = React.useState('');
  const [sortering, setSortering] = React.useState<AanvraagSortering>(leesSortering);
  const [aanvragen, setAanvragen] = React.useState<Aanvraag[] | undefined>();
  const [overzicht, setOverzicht] = React.useState<Record<number, DemoOverzicht>>({});
  const [fout, setFout] = React.useState<unknown>();
  const [, voerUit] = useBezig();
  const [bevestigDialoog, bevestig] = useBevestig();

  const laad = React.useCallback(async () => {
    try {
      const [lijst, demos] = await Promise.all([d.repo.aanvragen(filter), d.repo.demosVoorLijst()]);
      setOverzicht(demoOverzichtPerAanvraag(demos.demos, demos.inzet, new Date()));
      setAanvragen(lijst);
      setFout(undefined);
    } catch (e) {
      setFout(e);
    }
  }, [d.repo, filter]);

  React.useEffect(() => {
    localStorage.setItem(FILTER_SLEUTEL, JSON.stringify(filter));
    setAanvragen(undefined);
    laad().catch(() => undefined);
    // Nieuwe mail komt via de flow binnen; periodiek verversen zolang het scherm zichtbaar is.
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') laad().catch(() => undefined);
    }, VERVERS_MS);
    return () => window.clearInterval(t);
  }, [laad]);

  const kiesSortering = (waarde: AanvraagSortering): void => {
    localStorage.setItem(SORTERING_SLEUTEL, waarde);
    setSortering(waarde);
  };

  const wisselFilter = (status: Status): void => {
    setFilter(f => {
      if (status === 'Verwijderd') return f.length === 1 && f[0] === 'Verwijderd' ? OPEN_STATUSSEN.slice() : ['Verwijderd'];
      const zonderVerwijderd = f.filter(x => x !== 'Verwijderd');
      const nieuw = zonderVerwijderd.indexOf(status) >= 0 ? zonderVerwijderd.filter(x => x !== status) : zonderVerwijderd.concat(status);
      return nieuw.length ? nieuw : OPEN_STATUSSEN.slice();
    });
  };

  const wijzigStatus = async (a: Aanvraag, naar: Status): Promise<void> => {
    if (naar === 'Verwijderd') {
      const ok = await bevestig({
        titel: 'Aanvraag verwijderen?',
        tekst: 'De aanvraag gaat naar "Verwijderd" en de agenda-afspraken van alle demo’s worden verwijderd. Je kunt de aanvraag later terugzetten.',
        knop: 'Verwijderen',
        gevaarlijk: true
      });
      if (!ok) return;
    }
    await voerUit(() => d.acties.wijzigStatus(a, naar), 'Status gewijzigd naar ' + naar);
    await laad();
  };

  const markeer = async (a: Aanvraag, verwerkt: boolean): Promise<void> => {
    await voerUit(() => d.acties.markeerVerwerkt(a, verwerkt));
    await laad();
  };

  const term = zoek.trim().toLowerCase();
  const zichtbaar = sorteerAanvragen(
    (aanvragen || []).filter(a => !term || [a.titel, a.naam, a.organisatie, a.email].some(v => (v || '').toLowerCase().indexOf(term) >= 0)),
    sortering,
    overzicht
  );
  const sorteerLabel = SORTERINGEN.filter(x => x.waarde === sortering)[0].label;

  return (
    <div className={g.scherm}>
      {bevestigDialoog}
      <div className={g.kop}>
        <Input
          className={s.zoek}
          contentBefore={<SearchRegular />}
          placeholder="Zoeken op naam, organisatie, e-mail of titel"
          value={zoek}
          onChange={(_, v) => setZoek(v.value)}
        />
        <Tooltip content="Vernieuwen" relationship="label">
          <Button icon={<ArrowClockwiseRegular />} onClick={() => laad()} />
        </Tooltip>
        <Tooltip content="Nieuwe aanvraag (zonder e-mail)" relationship="label">
          <Button appearance="primary" icon={<AddRegular />} onClick={props.nieuw} />
        </Tooltip>
      </div>

      <div className={s.filters} role="group" aria-label="Filter op status">
        {STATUSSEN.map(st => (
          <ToggleButton key={st} size="small" shape="circular" checked={filter.indexOf(st) >= 0} onClick={() => wisselFilter(st)}>
            {st}
          </ToggleButton>
        ))}
        <Menu checkedValues={{ sortering: [sortering] }} onCheckedValueChange={(_, v) => kiesSortering(v.checkedItems[0] as AanvraagSortering)}>
          <MenuTrigger disableButtonEnhancement>
            <Button className={s.sorteer} size="small" shape="circular" appearance="subtle" icon={<ArrowSortRegular />} aria-label={'Sorteren op ' + sorteerLabel}>
              {sorteerLabel}
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {SORTERINGEN.map(x => (
                <MenuItemRadio key={x.waarde} name="sortering" value={x.waarde}>
                  {x.label}
                </MenuItemRadio>
              ))}
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>

      {fout ? <Fout fout={fout} /> : undefined}
      {!aanvragen && !fout && <Laden />}
      {aanvragen && zichtbaar.length === 0 && <div className={g.leeg}>Geen aanvragen gevonden.</div>}

      <div className={s.lijst}>
        {zichtbaar.map(a => {
          const o: DemoOverzicht | undefined = overzicht[a.id];
          // Bij verwijderde aanvragen zijn de afspraken bewust weggehaald; dan geen waarschuwingen.
          const waarschuw = !!o && a.status !== 'Verwijderd';
          const demoDatum = o && (o.volgende || o.laatste);
          const demoLabel = o && o.volgende ? 'Eerstvolgende demo' : 'Laatste demo';
          return (
            <div
              key={a.id}
              className={mergeClasses(s.rij, a.onbeantwoord && s.onbeantwoord)}
              role="button"
              tabIndex={0}
              onClick={() => props.open(a.id)}
              onKeyDown={e => (e.key === 'Enter' ? props.open(a.id) : undefined)}
            >
              <div className={s.indicatoren}>
                {a.onbeantwoord && (
                  <span className={s.indicator} title="Onbeantwoord">
                    <MailUnreadRegular aria-label="Onbeantwoord" />
                  </span>
                )}
                {waarschuw && o.nietInAgenda > 0 && (
                  <span className={s.waarschuwing} title={meervoud(o.nietInAgenda, 'demo staat', 'demo’s staan') + ' niet in de agenda'}>
                    <CalendarErrorRegular aria-label="Niet in de agenda" />
                  </span>
                )}
                {waarschuw && o.tekortBegeleiders > 0 && (
                  <span className={s.waarschuwing} title={meervoud(o.tekortBegeleiders, 'demo heeft', 'demo’s hebben') + ' te weinig begeleiders'}>
                    <PeopleErrorRegular aria-label="Te weinig begeleiders" />
                  </span>
                )}
              </div>
              <div className={s.tekst}>
                <div className={mergeClasses(s.titel, a.onbeantwoord && s.vet)}>{a.titel || a.naam || a.email || '(zonder titel)'}</div>
                <div className={s.sub}>{[a.naam !== a.titel ? a.naam : '', a.organisatie, a.email].filter(x => !!x).join(' · ')}</div>
              </div>
              <div className={s.rechts}>
                <StatusBadge status={a.status} size="small" />
                {o && demoDatum && (
                  <span
                    className={mergeClasses(s.demo, !o.volgende && s.demoVoorbij, sortering === 'demo' && !!o.volgende && s.demoNadruk)}
                    title={demoLabel + (o.aantal > 1 ? ' (' + o.aantal + ' demo’s in totaal)' : '')}
                  >
                    <CalendarLtrRegular aria-label={demoLabel} />
                    {datumTijdKort(demoDatum)}
                    {o.aantal > 1 && (
                      <span className={s.meer} aria-label={o.aantal + ' demo’s in totaal'}>
                        +{o.aantal - 1}
                      </span>
                    )}
                  </span>
                )}
                <span className={s.tijd}>{a.laatsteBerichtOp ? tijdstipRelatief(a.laatsteBerichtOp) : ''}</span>
              </div>
              <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <Button appearance="subtle" icon={<MoreVerticalRegular />} aria-label="Acties" />
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      {a.onbeantwoord ? (
                        <MenuItem icon={<CheckmarkCircleRegular />} onClick={() => markeer(a, true)}>
                          Markeren als verwerkt
                        </MenuItem>
                      ) : (
                        <MenuItem icon={<MailUnreadRegular />} onClick={() => markeer(a, false)}>
                          Markeren als onbeantwoord
                        </MenuItem>
                      )}
                      <MenuDivider />
                      {STATUSSEN.filter(st => st !== a.status).map(st => (
                        <MenuItem key={st} onClick={() => wijzigStatus(a, st)}>
                          Status: {st}
                        </MenuItem>
                      ))}
                    </MenuList>
                  </MenuPopover>
                </Menu>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
