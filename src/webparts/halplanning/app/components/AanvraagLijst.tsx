// Startscherm: lijst van aanvragen met statusfilters en zoeken (FR-10 t/m FR-16).

import * as React from 'react';
import {
  Button,
  Input,
  makeStyles,
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  ToggleButton,
  tokens,
  Tooltip
} from '@fluentui/react-components';
import { ArrowClockwiseRegular, MoreVerticalRegular, SearchRegular, CheckmarkCircleRegular, MailUnreadRegular } from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { tijdstipRelatief } from '../logic/datum';
import { Aanvraag, OPEN_STATUSSEN, Status, STATUSSEN } from '../model';
import { Fout, Laden, StatusBadge, useBevestig, useBezig, useGedeeldeStijl } from './algemeen';

const FILTER_SLEUTEL = 'halplanning.statusfilter';
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
  indicator: { color: tokens.colorBrandForeground1, flexShrink: 0 },
  zoek: { flexGrow: 1, minWidth: '180px' }
});

function leesFilter(): Status[] {
  try {
    const f = JSON.parse(localStorage.getItem(FILTER_SLEUTEL) || '') as Status[];
    if (Array.isArray(f) && f.length) return f.filter(s => STATUSSEN.indexOf(s) >= 0);
  } catch {
    // Geen of ongeldig opgeslagen filter: standaard.
  }
  return OPEN_STATUSSEN.slice();
}

export function AanvraagLijst(props: { open: (id: number) => void }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [filter, setFilter] = React.useState<Status[]>(leesFilter);
  const [zoek, setZoek] = React.useState('');
  const [aanvragen, setAanvragen] = React.useState<Aanvraag[] | undefined>();
  const [fout, setFout] = React.useState<unknown>();
  const [, voerUit] = useBezig();
  const [bevestigDialoog, bevestig] = useBevestig();

  const laad = React.useCallback(async () => {
    try {
      setAanvragen(await d.repo.aanvragen(filter));
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
  const zichtbaar = (aanvragen || []).filter(
    a => !term || [a.titel, a.naam, a.organisatie, a.email].some(v => (v || '').toLowerCase().indexOf(term) >= 0)
  );

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
      </div>

      <div className={s.filters} role="group" aria-label="Filter op status">
        {STATUSSEN.map(st => (
          <ToggleButton key={st} size="small" shape="circular" checked={filter.indexOf(st) >= 0} onClick={() => wisselFilter(st)}>
            {st}
          </ToggleButton>
        ))}
      </div>

      {fout ? <Fout fout={fout} /> : undefined}
      {!aanvragen && !fout && <Laden />}
      {aanvragen && zichtbaar.length === 0 && <div className={g.leeg}>Geen aanvragen gevonden.</div>}

      <div className={s.lijst}>
        {zichtbaar.map(a => (
          <div
            key={a.id}
            className={mergeClasses(s.rij, a.onbeantwoord && s.onbeantwoord)}
            role="button"
            tabIndex={0}
            onClick={() => props.open(a.id)}
            onKeyDown={e => (e.key === 'Enter' ? props.open(a.id) : undefined)}
          >
            {a.onbeantwoord && <MailUnreadRegular className={s.indicator} aria-label="Onbeantwoord" />}
            <div className={s.tekst}>
              <div className={mergeClasses(s.titel, a.onbeantwoord && s.vet)}>{a.titel || a.naam || a.email || '(zonder titel)'}</div>
              <div className={s.sub}>{[a.naam !== a.titel ? a.naam : '', a.organisatie, a.email].filter(x => !!x).join(' · ')}</div>
            </div>
            <div className={s.rechts}>
              <StatusBadge status={a.status} size="small" />
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
        ))}
      </div>
    </div>
  );
}
